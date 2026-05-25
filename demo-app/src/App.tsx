import { useState, useEffect, useCallback, useRef } from 'react';
import { initAnalyzer, parseSql, formatSql, getDiagnostics } from './analyzer';

const SAMPLE_QUERIES: { label: string; sql: string }[] = [
    {
        label: 'SELECT + JOIN + agg',
        sql: `SELECT
    e.event_name,
    e.timestamp,
    u.user_name,
    count() AS cnt,
    uniqExact(e.user_id) AS unique_users,
    avg(e.duration_ms) AS avg_duration
FROM db.events AS e
LEFT JOIN db.users AS u ON e.user_id = u.id
WHERE e.timestamp > now() - INTERVAL 1 DAY
GROUP BY e.event_name, e.timestamp, u.user_name
ORDER BY cnt DESC
LIMIT 100`,
    },
    {
        label: 'Arrays: groupArray, arrayEnumerate, arrayMap',
        sql: `SELECT
    user_id,
    groupArray(event_type) AS events,
    arrayEnumerate(events) AS idx,
    arrayMap(x -> upper(x), events) AS upper_events,
    arrayStringConcat(events, ' -> ') AS path,
    has(events, 'purchase') AS made_purchase,
    indexOf(events, 'login') AS first_login_pos,
    length(events) AS total_events
FROM db.user_events
WHERE date >= today() - 7
GROUP BY user_id
HAVING length(events) > 3
ORDER BY total_events DESC
LIMIT 50`,
    },
    {
        label: 'Date/time: toStartOf*, dateDiff, formatDateTime',
        sql: `SELECT
    toStartOfHour(timestamp) AS hour,
    toStartOfWeek(timestamp) AS week,
    toDate(timestamp) AS date,
    formatDateTime(timestamp, '%Y-%m-%d %H:%i:%S') AS formatted,
    dateDiff('day', timestamp, now()) AS days_ago,
    toDayOfWeek(timestamp) AS dow,
    toYYYYMM(timestamp) AS month_partition,
    date_trunc('minute', timestamp) AS truncated_minute
FROM db.events
WHERE timestamp BETWEEN toDateTime('2025-01-01 00:00:00') AND now()
ORDER BY timestamp DESC`,
    },
    {
        label: 'Strings: extract, splitBy, position, like',
        sql: `SELECT
    url,
    extract(url, 'utm_source=([^&]+)') AS utm_source,
    extractAll(url, '[?&]([^=]+)=([^&]+)') AS all_params,
    splitByChar('/', url) AS path_parts,
    position(url, '?') AS query_start_pos,
    substring(url, 1, position(url, '?') - 1) AS path_only,
    replaceRegexpAll(url, 'https?://', '') AS domain,
    multiMatchAny(url, ['\\.php', '\\.aspx', '\\.js']) AS has_script_ext,
    url LIKE '%search%' AS is_search
FROM db.pageviews`,
    },
    {
        label: 'Conditionals: multiIf, if, transform, CASE',
        sql: `SELECT
    user_id,
    age,
    multiIf(
        age < 18, 'minor',
        age < 30, 'young',
        age < 55, 'adult',
        'senior'
    ) AS age_group,
    if(gender = 'M', 'male', 'female') AS gender_display,
    transform(region, ['us', 'eu', 'as'], ['North America', 'Europe', 'Asia']) AS region_name,
    CASE
        WHEN total_spent > 1000 THEN 'VIP'
        WHEN total_spent > 100 THEN 'regular'
        ELSE 'new'
    END AS customer_tier
FROM db.users`,
    },
    {
        label: 'Window: ROW_NUMBER, rank, lag/lead',
        sql: `SELECT
    event_type,
    user_id,
    timestamp,
    count() OVER (PARTITION BY user_id ORDER BY timestamp
        ROWS BETWEEN 5 PRECEDING AND CURRENT ROW) AS rolling_count,
    row_number() OVER (PARTITION BY user_id ORDER BY timestamp) AS event_seq,
    rank() OVER (ORDER BY count() DESC) AS popularity_rank,
    lag(event_type, 1) OVER (PARTITION BY user_id ORDER BY timestamp) AS prev_event,
    lead(event_type, 1) OVER (PARTITION BY user_id ORDER BY timestamp) AS next_event
FROM db.events
WHERE date >= today() - 30`,
    },
    {
        label: 'Agg combinators: -If, -Array, -State, -Merge',
        sql: `SELECT
    user_id,
    avgIf(duration_ms, duration_ms > 0) AS avg_duration,
    sumIf(amount, status = 'completed') AS completed_total,
    countIf(event_type = 'error') AS error_count,
    quantileIf(0.95)(duration_ms, event_type = 'request') AS p95_request,
    groupArrayIf(url, is_error = 1) AS error_urls,
    minArray(array_column) AS min_val,
    uniqState(user_id) AS user_state
FROM db.metrics
WHERE date = today()
GROUP BY user_id`,
    },
    {
        label: 'IP/Geo: IPv4ToIPv6, toIPv6, geo functions',
        sql: `SELECT
    ip,
    toIPv6(ip) AS ipv6,
    IPv4ToIPv6(toIPv4(ip)) AS ipv4_to_v6,
    IPv6NumToString(ip) AS ip_str,
    geoToCountry(ip) AS country_code,
    geoToCity(ip) AS city_name,
    geoToLatitude(ip) AS lat,
    geoToLongitude(ip) AS lon
FROM db.access_log
WHERE isIPv4InRange(ip, '10.0.0.0/8') = 0
  AND isIPv6InRange(toIPv6(ip), 'fe80::/10') = 0`,
    },
    {
        label: 'URL: protocol, domain, path, extractURLParameters',
        sql: `SELECT
    url,
    protocol(url) AS proto,
    domain(url) AS domain,
    domainWithoutWWW(url) AS clean_domain,
    path(url) AS path,
    pathFull(url) AS full_path,
    queryString(url) AS query,
    fragment(url) AS hash,
    extractURLParameters(url) AS params,
    extractURLParameter(url, 'utm_source') AS utm_source,
    cutQueryStringAndFragment(url) AS base_url,
    decodeURLComponent(url) AS decoded
FROM db.pageviews`,
    },
    {
        label: 'JSON: visitParam*, JSONExtract*, simpleJSONExtract',
        sql: `SELECT
    raw_payload,
    JSONExtractString(raw_payload, 'event') AS event_name,
    JSONExtractInt(raw_payload, 'user_id') AS user_id,
    JSONExtractFloat(raw_payload, 'duration') AS duration,
    JSONExtract(raw_payload, 'properties', 'Nested(key String, value String)') AS props,
    JSONHas(raw_payload, 'error') AS has_error,
    simpleJSONExtractString(raw_payload, 'status') AS status,
    visitParamExtractString(raw_payload, 'ref') AS referrer,
    visitParamExtractUInt(raw_payload, 'count') AS visit_count,
    visitParamHas(raw_payload, 'bot') AS is_bot
FROM db.raw_json_events
WHERE JSONIsValid(raw_payload) = 1`,
    },
    {
        label: 'Hashes: cityHash64, sipHash, xxHash, farmHash, SHA',
        sql: `SELECT
    user_id,
    cityHash64(concat(toString(user_id), email, phone)) AS user_hash,
    sipHash64(event_type, timestamp) AS event_hash,
    xxHash64(url) AS url_hash,
    farmHash64(ip_str) AS ip_hash,
    SHA256(concat(password, salt)) AS password_hash,
    MD5(email) AS email_hash,
    halfMD5(concat(toString(user_id), session_id)) AS session_hash,
    intHash32(user_id) AS int_hash
FROM db.users`,
    },
    {
        label: 'Type casts: to*, CAST, accurateCast, parseDateTime',
        sql: `SELECT
    toString(user_id) AS str_id,
    toInt64(str_id) AS int_id,
    toFloat64(amount_str) AS amount,
    toDecimal64(price_str, 2) AS price,
    CAST(created_at_str AS DateTime) AS created_at,
    parseDateTimeBestEffort(timestamp_str) AS parsed_ts,
    parseDateTimeBestEffortOrNull(bad_timestamp) AS safe_parsed,
    toDateOrNull(date_str) AS date_val,
    accurateCastOrNull(str_col, 'UInt64') AS accurate_val,
    toBool(flag) AS bool_val
FROM db.staging
WHERE isNotNull(safe_parsed)`,
    },
    {
        label: 'CTE + subqueries + UNION ALL',
        sql: `WITH
    active_users AS (
        SELECT user_id
        FROM db.sessions
        WHERE last_active > now() - INTERVAL 30 DAY
    ),
    user_revenue AS (
        SELECT
            user_id,
            sum(amount) AS total_rev
        FROM db.purchases
        WHERE date >= toStartOfMonth(today())
        GROUP BY user_id
    )
SELECT
    u.user_id,
    u.user_name,
    tot.total_rev,
    if(tot.total_rev > 0, 'payer', 'free') AS tier
FROM active_users AS u
LEFT JOIN user_revenue AS tot USING (user_id)

UNION ALL

SELECT
    user_id,
    'unknown' AS user_name,
    0 AS total_rev,
    'legacy' AS tier
FROM db.legacy_users
WHERE user_id NOT IN (SELECT user_id FROM active_users)
ORDER BY total_rev DESC`,
    },
    {
        label: 'CREATE TABLE: ReplacingMergeTree, TTL, CODEC',
        sql: `CREATE TABLE IF NOT EXISTS db.user_sessions (
    session_id UUID,
    user_id UInt64,
    started_at DateTime CODEC(Delta, ZSTD),
    ended_at DateTime,
    device_type LowCardinality(String),
    os_version String,
    app_version String,
    ip IPv6,
    properties Map(String, String),
    sign Int8
) ENGINE = ReplacingMergeTree(sign)
PARTITION BY toYYYYMM(started_at)
ORDER BY (user_id, session_id)
TTL started_at + INTERVAL 90 DAY DELETE
SETTINGS index_granularity = 8192`,
    },
    {
        label: 'CREATE TABLE: Kafka engine + MV',
        sql: `CREATE TABLE IF NOT EXISTS db.events_queue (
    raw String
) ENGINE = Kafka()
SETTINGS
    kafka_broker_list = 'kafka1:9092,kafka2:9092',
    kafka_topic_list = 'clickhouse.events',
    kafka_group_name = 'ch_consumer_group',
    kafka_format = 'JSONEachRow',
    kafka_num_consumers = 4;

CREATE MATERIALIZED VIEW db.events_mv TO db.events AS
SELECT
    JSONExtractString(raw, 'event') AS event_name,
    JSONExtractString(raw, 'user_id') AS user_id,
    now() AS _inserted_at
FROM db.events_queue`,
    },
    {
        label: 'ALTER: materialize column, UPDATE, DELETE',
        sql: `ALTER TABLE db.events
    MATERIALIZE COLUMN session_id,
    MATERIALIZE INDEX idx_event_type;

ALTER TABLE db.users
    UPDATE email = lower(email)
    WHERE email != lower(email);

ALTER TABLE db.events
    DELETE WHERE timestamp < now() - INTERVAL 365 DAY;

ALTER TABLE db.users
    MODIFY COLUMN status Enum8('active' = 1, 'inactive' = 2, 'banned' = 3);`,
    },
    {
        label: 'Array JOIN + PREWHERE + SAMPLE + FINAL',
        sql: `SELECT
    user_id,
    tag,
    count() AS tag_count,
    avg(session_length) AS avg_session
FROM db.user_tags FINAL
ARRAY JOIN tags AS tag
PREWHERE user_id IN (
    SELECT user_id
    FROM db.active_users
    SAMPLE 0.1
)
WHERE date >= today() - 7
GROUP BY user_id, tag
ORDER BY tag_count DESC
LIMIT 20`,
    },
    {
        label: 'Dictionaries: dictGet, dictGetOrDefault',
        sql: `SELECT
    e.event_type,
    e.user_id,
    e.timestamp,
    dictGet('db.region_dict', 'region_name', e.user_id) AS region,
    dictGetOrDefault('db.country_dict', 'country_name', e.user_id, 'Unknown') AS country,
    dictGetHierarchy('db.category_dict', e.event_type) AS category_path,
    dictGetChildren('db.category_dict', e.event_type) AS children,
    dictHas('db.banned_users', e.user_id) AS is_banned
FROM db.events AS e
WHERE dictGetOrNull('db.region_dict', 'region_name', e.user_id) IS NOT NULL`,
    },
    {
        label: 'SYSTEM + EXISTS + RENAME + TRUNCATE',
        sql: `SYSTEM FLUSH LOGS;

EXISTS TABLE db.events;

RENAME TABLE db.events_old TO db.events;

TRUNCATE TABLE IF EXISTS db.events_staging;

SYSTEM START MERGES db.events;
SYSTEM STOP MERGES db.events;

OPTIMIZE TABLE db.events FINAL;

CHECK TABLE db.events;

DROP DICTIONARY IF EXISTS db.region_dict;
CREATE OR REPLACE DICTIONARY db.region_dict (
    user_id UInt64,
    region_name String
)
PRIMARY KEY user_id
SOURCE(CLICKHOUSE(
    HOST 'localhost' PORT 9000
    USER 'default' TABLE 'regions'
    DB 'db'
))
LAYOUT(FLAT())
LIFETIME(MIN 300 MAX 360);`,
    },
    {
        label: 'AggregatingMergeTree: -State / -Merge',
        sql: `CREATE TABLE db.daily_stats_agg (
    date Date,
    event_type LowCardinality(String),
    uniq_users AggregateFunction(uniq, UInt64),
    total_amount AggregateFunction(sum, Decimal64(2)),
    p95_duration AggregateFunction(quantile(0.95), Float64)
) ENGINE = AggregatingMergeTree()
PARTITION BY toYYYYMM(date)
ORDER BY (date, event_type);

INSERT INTO db.daily_stats_agg
SELECT
    toDate(timestamp) AS date,
    event_type,
    uniqState(user_id) AS uniq_users,
    sumState(amount) AS total_amount,
    quantileState(0.95)(duration_ms) AS p95_duration
FROM db.events
WHERE date = today()
GROUP BY date, event_type;

SELECT
    date,
    event_type,
    uniqMerge(uniq_users) AS users,
    sumMerge(total_amount) AS revenue,
    quantileMerge(0.95)(p95_duration) AS p95
FROM db.daily_stats_agg
WHERE date >= today() - 30
GROUP BY date, event_type
ORDER BY date, event_type`,
    },
    {
        label: 'Error: missing FROM',
        sql: `SELECT a, b, count(*)
WHERE id > 10
GROUP BY a
ORDER BY b`,
    },
    {
        label: 'Error: unclosed paren',
        sql: `SELECT (1 + 2 * (3 - 4
FROM debug.table`,
    },
    {
        label: 'Error: wrong keyword',
        sql: `SELEC * FORM db.users WERE id = 1`,
    },
    {
        label: 'Error: missing comma in columns',
        sql: `SELECT
    user_id
    event_type
    timestamp
FROM db.events`,
    },
    {
        label: 'Error: ambiguous column',
        sql: `SELECT id, name FROM db.a
JOIN db.b ON a.id = b.id
WHERE id > 100`,
    },
    {
        label: 'Error: unknown functions',
        sql: `SELECT
    quantileeeee(0.5)(toFloat64(1.0)) AS q,
    avgG(amount) AS avg_amount,
    cityHash64(user_id) AS hash
FROM db.events
WHERE date = today()
GROUP BY user_id`,
    },
];

const COLORS: Record<string, string> = {
    Error: '#e06c75',
    Warning: '#e5c07b',
    Info: '#61afef',
};

export default function App() {
    const [sql, setSql] = useState('');
    const [errors, setErrors] = useState<{ message: string; range: [number, number]; severity: string; code: string | null; suggestion: string | null }[]>([]);
    const [formatted, setFormatted] = useState('');
    const [tree, setTree] = useState('');
    const [ready, setReady] = useState(false);
    const [activeTab, setActiveTab] = useState<'errors' | 'formatted' | 'tree'>('errors');
    const [loading, setLoading] = useState(true);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        initAnalyzer()
            .then(() => {
                setReady(true);
                setLoading(false);
            })
            .catch((e) => {
                console.error('Failed to load analyzer:', e);
                setLoading(false);
            });
    }, []);

    const analyze = useCallback((value: string) => {
        if (!ready) return;
        try {
            const diags = getDiagnostics(value);
            setErrors(diags);
        } catch {
            setErrors([]);
        }
        try {
            setFormatted(formatSql(value));
        } catch {
            setFormatted('');
        }
        try {
            const parsed = parseSql(value);
            setTree(JSON.stringify(parsed, null, 2));
        } catch {
            setTree('');
        }
    }, [ready]);

    const handleInput = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const value = e.target.value;
        setSql(value);
        analyze(value);
    }, [analyze]);

    const selectSample = useCallback((sampleSql: string) => {
        setSql(sampleSql);
        analyze(sampleSql);
    }, [analyze]);

    const highlightError = useCallback((line: number, col: number) => {
        const ta = textareaRef.current;
        if (!ta) return;
        const lines = sql.split('\n');
        const targetLine = Math.min(line - 1, lines.length - 1);
        let pos = 0;
        for (let i = 0; i < targetLine; i++) pos += lines[i].length + 1;
        if (pos > sql.length) pos = sql.length;
        pos += Math.min(col, lines[targetLine]?.length ?? 0);
        ta.focus();
        ta.setSelectionRange(pos, pos);
    }, [sql]);

    const errCount = errors.filter(e => e.severity === 'Error').length;
    const warnCount = errors.filter(e => e.severity === 'Warning').length;
    const hintCount = errors.filter(e => e.severity === 'Hint').length;
    const totalIssues = errors.length;

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: '#abb2bf' }}>
                Loading clickhouse-analyzer WASM...
            </div>
        );
    }

    return (
        <div style={{
            display: 'grid',
            gridTemplateColumns: '260px 1fr',
            gridTemplateRows: '1fr auto',
            height: '100vh',
            backgroundColor: '#1e1e1e',
            color: '#abb2bf',
            fontFamily: 'Consolas, Monaco, "Courier New", monospace',
        }}>
            <aside style={{
                gridRow: '1 / 3',
                borderRight: '1px solid #3e3e42',
                padding: '12px',
                overflow: 'auto',
            }}>
                <h2 style={{ fontSize: '14px', color: '#61afef', margin: '0 0 12px' }}>Sample Queries</h2>
                {SAMPLE_QUERIES.map((q, i) => (
                    <button
                        key={i}
                        onClick={() => selectSample(q.sql)}
                        title={q.label}
                        style={{
                            display: 'block',
                            width: '100%',
                            textAlign: 'left',
                            padding: '6px 10px',
                            marginBottom: '4px',
                            border: 'none',
                            borderRadius: '4px',
                            backgroundColor: sql === q.sql ? '#264f78' : 'transparent',
                            color: sql === q.sql ? '#fff' : '#abb2bf',
                            cursor: 'pointer',
                            fontSize: '12px',
                            fontFamily: 'inherit',
                        }}>
                        {q.label}
                    </button>
                ))}
            </aside>

            <main style={{
                display: 'grid',
                gridTemplateRows: 'minmax(200px, 1fr) auto auto',
                gap: 0,
                overflow: 'hidden',
            }}>
                <div style={{ position: 'relative', overflow: 'hidden' }}>
                    <textarea
                        ref={textareaRef}
                        value={sql}
                        onChange={handleInput}
                        spellCheck={false}
                        placeholder="Enter ClickHouse SQL..."
                        style={{
                            width: '100%',
                            height: '100%',
                            padding: '16px',
                            border: 'none',
                            outline: 'none',
                            resize: 'none',
                            backgroundColor: '#252526',
                            color: '#d4d4d4',
                            fontFamily: 'inherit',
                            fontSize: '14px',
                            lineHeight: '1.6',
                            tabSize: 4,
                        }}
                    />
                </div>

                <div style={{
                    display: 'flex',
                    borderTop: '1px solid #3e3e42',
                    backgroundColor: '#252526',
                    padding: '0 16px',
                }}>
                    {(['errors', 'formatted', 'tree'] as const).map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            style={{
                                padding: '8px 16px',
                                border: 'none',
                                borderBottom: activeTab === tab ? '2px solid #61afef' : '2px solid transparent',
                                backgroundColor: 'transparent',
                                color: activeTab === tab ? '#61afef' : '#6a6a6a',
                                cursor: 'pointer',
                                fontSize: '12px',
                                fontWeight: activeTab === tab ? 600 : 400,
                                fontFamily: 'inherit',
                                textTransform: 'uppercase',
                            }}>
                            {tab === 'errors' && `Issues (${totalIssues})`}
                            {tab === 'formatted' && 'Formatted'}
                            {tab === 'tree' && 'CST Tree'}
                        </button>
                    ))}
                    {warnCount > 0 && (
                        <span style={{ marginLeft: 'auto', padding: '8px 0', fontSize: '11px', color: COLORS.Warning }}>
                            {warnCount} warning{warnCount > 1 ? 's' : ''}
                        </span>
                    )}
                    {hintCount > 0 && (
                        <span style={{ marginLeft: errCount > 0 ? '8px' : 'auto', padding: '8px 0', fontSize: '11px', color: COLORS.Info }}>
                            {hintCount} hint{hintCount > 1 ? 's' : ''}
                        </span>
                    )}
                </div>

                <div style={{
                    height: '200px',
                    overflow: 'auto',
                    padding: '8px 16px',
                    backgroundColor: '#1e1e1e',
                    borderTop: '1px solid #3e3e42',
                }}>
                    {activeTab === 'errors' && (
                        errors.length === 0
                            ? <div style={{ color: '#6a9955', fontSize: '13px', padding: '8px 0' }}>No issues found</div>
                            : errors.map((e, i) => {
                                const [start] = e.range;
                                const lines = sql.substring(0, start).split('\n');
                                const line = lines.length;
                                const col = start - (lines.slice(0, -1).join('\n').length + (lines.length > 1 ? 1 : 0)) + 1;
                                const errorLine = sql.split('\n')[line - 1] || '';
                                return (
                                    <div
                                        key={i}
                                        onClick={() => highlightError(line, col - 1)}
                                        style={{
                                            padding: '4px 0',
                                            cursor: 'pointer',
                                            borderBottom: '1px solid #2d2d2d',
                                        }}>
                                        <span style={{
                                            color: COLORS[e.severity] || '#e06c75',
                                            fontWeight: 600,
                                            fontSize: '11px',
                                            marginRight: '8px',
                                        }}>
                                            {e.severity.toUpperCase()}
                                            {e.code && <span style={{ fontWeight: 400, opacity: 0.7 }}> [{e.code}]</span>}
                                        </span>
                                        <span style={{ fontSize: '12px', color: '#6a6a6a' }}>
                                            {line}:{col}
                                        </span>
                                        <span style={{ fontSize: '12px', marginLeft: '8px', color: '#abb2bf' }}>
                                            {e.message}
                                        </span>
                                        {e.suggestion && (
                                            <span style={{ fontSize: '11px', marginLeft: '8px', color: '#61afef' }}>
                                                hint: {e.suggestion}
                                            </span>
                                        )}
                                        <div style={{
                                            marginTop: '2px',
                                            fontSize: '11px',
                                            color: '#5a5a5a',
                                            whiteSpace: 'pre',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                        }}>
                                            {errorLine}
                                        </div>
                                    </div>
                                );
                            })
                    )}
                    {activeTab === 'formatted' && (
                        <pre style={{
                            margin: 0,
                            fontSize: '13px',
                            color: '#d4d4d4',
                            whiteSpace: 'pre-wrap',
                            fontFamily: 'inherit',
                        }}>
                            {formatted || 'Enter SQL to see formatted output'}
                        </pre>
                    )}
                    {activeTab === 'tree' && (
                        <pre style={{
                            margin: 0,
                            fontSize: '11px',
                            color: '#6a9955',
                            whiteSpace: 'pre-wrap',
                            fontFamily: 'inherit',
                            maxHeight: '100%',
                        }}>
                            {tree || 'Enter SQL to see CST tree'}
                        </pre>
                    )}
                </div>
            </main>
        </div>
    );
}
