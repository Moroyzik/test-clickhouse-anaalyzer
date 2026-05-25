/**
 * A syntax node in the parsed tree. Wraps either a tree node or a token,
 * providing uniform navigation and text extraction.
 */
export class SyntaxNode {
    constructor(kind, start, end, children, isToken, source) {
        /** Parent reference, set during tree construction. */
        this.parent = null;
        this.kind = kind;
        this.start = start;
        this.end = end;
        this.children = children;
        this.isToken = isToken;
        this._source = source;
    }
    /** Get the source text this node spans. */
    text() {
        return this._source.slice(this.start, this.end);
    }
    /** Find all descendant nodes matching the given kind. */
    findAll(kind) {
        const results = [];
        this._collect(kind, results);
        return results;
    }
    /** Find the first descendant node matching the given kind, or null. */
    findFirst(kind) {
        return this._findFirst(kind);
    }
    /** Depth-first walk of this node and all descendants. */
    walk(callback) {
        this._walk(callback, 0);
    }
    /** Walk up to the root, returning all ancestors (nearest first). */
    ancestors() {
        const result = [];
        let current = this.parent;
        while (current) {
            result.push(current);
            current = current.parent;
        }
        return result;
    }
    /** Get only tree children (skip tokens). */
    treeChildren() {
        return this.children.filter((c) => !c.isToken);
    }
    /** Get only token children (skip subtrees). */
    tokenChildren() {
        return this.children.filter((c) => c.isToken);
    }
    _collect(kind, results) {
        const stack = [this];
        while (stack.length > 0) {
            const node = stack.pop();
            if (node.kind === kind)
                results.push(node);
            for (let i = node.children.length - 1; i >= 0; i--) {
                stack.push(node.children[i]);
            }
        }
    }
    _findFirst(kind) {
        const stack = [this];
        while (stack.length > 0) {
            const node = stack.pop();
            if (node.kind === kind)
                return node;
            for (let i = node.children.length - 1; i >= 0; i--) {
                stack.push(node.children[i]);
            }
        }
        return null;
    }
    _walk(callback, depth) {
        const stack = [{ node: this, depth }];
        while (stack.length > 0) {
            const { node, depth: d } = stack.pop();
            callback(node, d);
            // Push children in reverse order so first child is processed first
            for (let i = node.children.length - 1; i >= 0; i--) {
                stack.push({ node: node.children[i], depth: d + 1 });
            }
        }
    }
}
/** Result of parsing a SQL string. */
export class ParseResult {
    constructor(tree, errors, source) {
        this.tree = tree;
        this.errors = errors;
        this.source = source;
    }
    /** Shorthand: find all nodes of the given kind in the entire tree. */
    findAll(kind) {
        return this.tree.findAll(kind);
    }
    /** Shorthand: find the first node of the given kind in the entire tree. */
    findFirst(kind) {
        return this.tree.findFirst(kind);
    }
    /** Returns true if the parse produced no errors. */
    get ok() {
        return this.errors.length === 0;
    }
}
/** A parse error with message and byte range. */
export class SyntaxError {
    constructor(message, start, end) {
        this.message = message;
        this.start = start;
        this.end = end;
    }
}
/** Build a SyntaxNode tree from the raw JSON structure. */
function buildNode(raw, source, parent) {
    const root = new SyntaxNode(raw.kind, raw.start, raw.end, [], false, source);
    root.parent = parent;
    const stack = [
        { rawChildren: raw.children, parentNode: root },
    ];
    while (stack.length > 0) {
        const { rawChildren, parentNode } = stack.pop();
        for (const child of rawChildren) {
            if ("Token" in child) {
                const t = child.Token;
                const tokenNode = new SyntaxNode(t.kind, t.start, t.end, [], true, source);
                tokenNode.parent = parentNode;
                parentNode.children.push(tokenNode);
            }
            else {
                const r = child.Tree;
                const node = new SyntaxNode(r.kind, r.start, r.end, [], false, source);
                node.parent = parentNode;
                parentNode.children.push(node);
                stack.push({ rawChildren: r.children, parentNode: node });
            }
        }
    }
    return root;
}
/** Convert raw JSON parse result into a typed ParseResult. */
export function buildParseResult(raw) {
    const tree = buildNode(raw.tree, raw.source, null);
    const errors = raw.errors.map((e) => new SyntaxError(e.message, e.range[0], e.range[1]));
    return new ParseResult(tree, errors, raw.source);
}
//# sourceMappingURL=parse.js.map