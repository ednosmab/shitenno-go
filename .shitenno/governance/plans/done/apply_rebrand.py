#!/usr/bin/env python3
"""
apply_rebrand.py — Aplica o rebranding Shitenno -> Shitenno de fato.

Uso:
    python3 apply_rebrand.py /caminho/do/repo [--dry-run] [--changelog log.md]

Regras:
  - Conteudo dentro de qualquer caminho que contenha
    "governance/plans/done" NAO e reescrito (historico imutavel).
  - "shitenno" (qualquer casing) -> "shitenno"
  - token isolado "shugo"/"Shugo"/"SHUGO" (CLI) -> "shugo"/"Shugo"/"SHUGO"
  - tokens compostos: a fatia "shugo"/"Shugo"/"SHUGO" dentro do
    identificador vira "shugo"/"Shugo"/"SHUGO" se for claramente CLI
    (ver CLI_TOKENS / heuristica de contexto), senao vira
    "shitenno"/"Shitenno"/"SHITENNO" (diretorio/plataforma/produto).
  - Pasta raiz "shitenno/" (artefato dogfood) -> ".shitenno/"
  - Demais paths contendo "shugo" sao renomeados seguindo a mesma regra.
"""

import argparse
import re
import shutil
import sys
from pathlib import Path

SKIP_DIRS = {"node_modules", ".git", "dist", "build", ".next", "coverage"}
SKIP_EXT = {".png", ".jpg", ".jpeg", ".gif", ".ico", ".woff", ".woff2", ".ttf"}
IMMUTABLE_MARKER = "governance/plans/done"

# Tokens explicitos ja revisados manualmente na conversa (decisao humana).
CLI_TOKENS = {
    "shugo", "shugoCommand", "shugoBinPath", "runShugo", "run_shugo_command",
    "getAllowedShugoCommand", "isShugoCommandAllowed", "RunShugoCommandExecutor",
    "_shugo_hook_precmd", "_shugo_hook_preexec", "_shugo_preexec",
    "_shugo_prompt_command", "_shugo_session_id", "_shugo_session_start",
    "_shugo_high_reminders", "nShugo", "createShugoCommand",
}

# Tokens que ja tem forma final explicita (nao seguem a regra generica).
EXPLICIT_MAP = {
    "scaffoldShitenno": "scaffoldShitenno",
    "_shitennoDir": "_shitennoDir",
    "operacao_no_shitenno": "operacao_no_shitenno",
    "DefaultShitennoStateMachine": "DefaultShitennoStateMachine",
    "ShitennoConsole": "ShitennoConsole",
    "ShitennoConsoleInner": "ShitennoConsoleInner",
    "ShitennoConsoleProps": "ShitennoConsoleProps",
    "nshitenno": "nshitenno",  # ja correto, sem mudanca
}

TOKEN_RE = re.compile(
    r"[A-Za-z_-]*[Ss][Hh][Ii][Tt][Ee][Nn](?:[Nn][Oo])?(?:-[Gg][Oo])?[A-Za-z_-]*"
)


def transform_token(token: str) -> str:
    if token in EXPLICIT_MAP:
        return EXPLICIT_MAP[token]

    low = token.lower()

    # 1. "shitenno" ou "shitenno" embutido -> vira "shitenno"
    if "shitenno" in low or "shitenno" in low:
        # troca preservando o resto do token, so remove o sufixo "-go"/"go" do brand
        new = re.sub(r"shitenno[-_]?go", lambda m: _match_case(m.group(0)[:8], "shitenno"), token, flags=re.IGNORECASE)
        return new

    # 2. ja e "shitenno" isolado (sem "-go") -> sem mudanca
    if low == "shitenno":
        return token

    # 3. token isolado "shugo" (nao "shitenno") -> CLI, vira "shugo"
    if low == "shugo":
        return _match_case(token, "shugo")

    # 4. token conhecido de CLI -> substitui a fatia shitenno->shugo
    if token in CLI_TOKENS or low in CLI_TOKENS:
        return re.sub(r"shugo", lambda m: _match_case(m.group(0), "shugo"), token, count=1, flags=re.IGNORECASE)

    # 5. heuristica de contexto: nomes de comando/hook/bin -> CLI
    cli_hint = re.search(r"(command|bin|hook|preexec|precmd|session)", low)
    if cli_hint and "dir" not in low:
        return re.sub(r"shugo(?!no)", lambda m: _match_case(m.group(0), "shugo"), token, count=1, flags=re.IGNORECASE)

    # 6. default: diretorio/plataforma/produto -> shugo vira shitenno
    return re.sub(r"shugo(?!no)", lambda m: _match_case(m.group(0), "shitenno"), token, count=1, flags=re.IGNORECASE)


def _match_case(sample: str, target: str) -> str:
    if sample.isupper():
        return target.upper()
    if sample[0].isupper():
        return target[0].upper() + target[1:]
    return target


# O valor da constante de diretorio precisa do ponto (convencao dotfile
# ".shitenno"), diferente do nome do pacote/produto ("shitenno" sem ponto).
# Aplicado depois da substituicao generica de tokens.
DIR_NAME_VALUE_RE = re.compile(r'(_DIR_NAME\s*=\s*)"shitenno"')


def rewrite_content(text: str) -> str:
    text = TOKEN_RE.sub(lambda m: transform_token(m.group(0)), text)
    text = DIR_NAME_VALUE_RE.sub(r'\1".shitenno"', text)
    return text


def rewrite_name(name: str) -> str:
    return TOKEN_RE.sub(lambda m: transform_token(m.group(0)), name)


def is_immutable(path: Path, root: Path) -> bool:
    rel = str(path.relative_to(root))
    return IMMUTABLE_MARKER in rel


def apply(root: Path, dry_run: bool, changelog_path: Path):
    content_changes = []
    path_renames = []

    # 1. Conteudo primeiro (paths antigos ainda existem)
    for filepath in root.rglob("*"):
        if not filepath.is_file():
            continue
        if any(part in SKIP_DIRS for part in filepath.parts):
            continue
        if filepath.suffix.lower() in SKIP_EXT:
            continue
        if is_immutable(filepath, root):
            continue
        try:
            text = filepath.read_text(encoding="utf-8")
        except (UnicodeDecodeError, OSError):
            continue
        new_text = rewrite_content(text)
        if new_text != text:
            content_changes.append(str(filepath.relative_to(root)))
            if not dry_run:
                filepath.write_text(new_text, encoding="utf-8")

    # 2. Paths (arquivos e pastas), do mais profundo pro mais raso
    all_paths = sorted(
        [p for p in root.rglob("*") if not any(part in SKIP_DIRS for part in p.parts)],
        key=lambda p: len(p.parts),
        reverse=True,
    )
    for p in all_paths:
        if not p.exists():
            continue
        if is_immutable(p, root):
            continue
        new_name = rewrite_name(p.name)
        if new_name != p.name:
            new_path = p.with_name(new_name)
            path_renames.append((str(p.relative_to(root)), str(new_path.relative_to(root))))
            if not dry_run:
                p.rename(new_path)

    with changelog_path.open("w", encoding="utf-8") as f:
        f.write("# Changelog do rebranding\n\n")
        f.write(f"## Conteudo alterado ({len(content_changes)} arquivos)\n\n")
        for c in content_changes:
            f.write(f"- {c}\n")
        f.write(f"\n## Paths renomeados ({len(path_renames)})\n\n")
        for old, new in path_renames:
            f.write(f"- `{old}` -> `{new}`\n")

    return content_changes, path_renames


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("repo_path")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--changelog", default="changelog-rebrand.md")
    args = parser.parse_args()

    root = Path(args.repo_path).resolve()
    changelog = Path(args.changelog)
    content_changes, path_renames = apply(root, args.dry_run, changelog)

    print(f"Arquivos com conteudo alterado: {len(content_changes)}")
    print(f"Paths renomeados: {len(path_renames)}")
    print(f"Changelog: {changelog.resolve()}")
    if args.dry_run:
        print("\n[DRY RUN] Nenhuma alteracao foi escrita em disco.")


if __name__ == "__main__":
    main()
