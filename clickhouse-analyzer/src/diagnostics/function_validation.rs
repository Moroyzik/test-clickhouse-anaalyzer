use super::generated_function_names;

use super::types::{Diagnostic, Severity};
use crate::parser::syntax_kind::SyntaxKind;
use crate::parser::syntax_tree::{SyntaxChild, SyntaxTree};

fn find_function_calls(tree: &SyntaxTree, source: &str) -> Vec<(String, usize, usize)> {
    let mut results = Vec::new();
    collect_function_calls(tree, source, &mut results);
    results
}

fn collect_function_calls(
    tree: &SyntaxTree,
    source: &str,
    results: &mut Vec<(String, usize, usize)>,
) {
    if tree.kind == SyntaxKind::FunctionCall {
        if let Some(name) = extract_function_name(tree, source) {
            results.push((name, tree.start as usize, tree.end as usize));
        }
    }

    for child in &tree.children {
        if let SyntaxChild::Tree(subtree) = child {
            collect_function_calls(subtree, source, results);
        }
    }
}

fn extract_function_name(func_call: &SyntaxTree, source: &str) -> Option<String> {
    let first_child = func_call.children.first()?;

    let identifier_tree = match first_child {
        SyntaxChild::Tree(tree) if tree.kind == SyntaxKind::Identifier => tree,
        _ => return None,
    };

    for child in &identifier_tree.children {
        if let SyntaxChild::Token(token) = child {
            let text = token.text(source);
            if !text.is_empty() {
                return Some(text.to_string());
            }
        }
    }

    None
}

fn is_known_function(name: &str) -> bool {
    generated_function_names::KNOWN_FUNCTIONS
        .binary_search(&name)
        .is_ok()
        || generated_function_names::KNOWN_FUNCTIONS
            .binary_search_by(|probe| {
                probe.to_ascii_lowercase().cmp(&name.to_ascii_lowercase())
            })
            .is_ok()
}

pub fn enrich(diagnostics: &mut Vec<Diagnostic>, tree: &SyntaxTree, source: &str) {
    let fn_calls = find_function_calls(tree, source);

    for (name, start, end) in fn_calls {
        if !is_known_function(&name) {
            diagnostics.push(Diagnostic {
                message: format!("Unknown function: \"{name}\""),
                range: (start, end),
                severity: Severity::Warning,
                code: Some("unknown-function"),
                suggestion: None,
                related: Vec::new(),
            });
        }
    }
}
