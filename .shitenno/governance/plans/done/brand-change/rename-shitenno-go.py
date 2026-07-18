#!/usr/bin/env python3
"""
Rebranding mecânico: Shitenno-go / shitenno-go / shitenno-cli -> Shitenno-go / shitenno-go / shitenno-cli

Uso:
    python3 rename-shitenno-go.py /caminho/para/o/repo [--dry-run]

O que faz:
  1. Substitui o CONTEÚDO de todos os arquivos de texto (regras ordenadas,
     compostos primeiro, depois o termo "shiten" isolado -> "shiten").
  2. Renomeia ARQUIVOS e PASTAS cujo nome contenha "shiten" (mesmas regras).
  3. Imprime um relatório final e confirma que não sobrou nenhuma ocorrência.

Roda quantas vezes for preciso (é idempotente: depois da primeira execução
não sobra "shiten" em lugar nenhum, então uma segunda execução não altera nada).

O que fica de fora (não mexe):
  - node_modules/, .git/
  - pnpm-lock.yaml (regenerar depois com `pnpm install`)
  - binários (png, jpg, gif, ico, woff, woff2, ttf)

Convenção aplicada:
  Shitenno-go / shitenno-go            -> Shitenno-go / shitenno-go
  shitenno-cli                              -> shitenno-cli
  shitenno-dashboard                        -> shitenno-dashboard
  qualquer "shiten"/"Shiten"/"SHITEN" isolado
  (comando CLI, identificadores de código: shitenDir, ShitenError,
   SHITEN_DIR_NAME...)                    -> shiten / Shiten / SHITEN
"""

import os
import sys
import argparse

SKIP_DIRS = {"node_modules", ".git"}
SKIP_EXT = {".png", ".jpg", ".jpeg", ".gif", ".ico", ".woff", ".woff2", ".ttf"}
SKIP_FILES = {"pnpm-lock.yaml"}

# Ordem importa: compostos mais específicos primeiro, "shiten" isolado por último.
CONTENT_REPLACEMENTS = [
    ("SHITENNO-GO", "SHITENNO-GO"),
    ("SHITENNO_GO", "SHITENNO_GO"),
    ("Shitenno-go", "Shitenno-go"),
    ("Shitenno-go", "Shitenno-go"),
    ("ShitennoGo", "ShitennoGo"),
    ("shitennoGo", "shitennoGo"),
    ("shitenno-go", "shitenno-go"),
    ("shitenno_go", "shitenno_go"),
    ("SHITENNO-CLI", "SHITENNO-CLI"),
    ("SHITENNO_CLI", "SHITENNO_CLI"),
    ("Shitenno-cli", "Shitenno-cli"),
    ("Shitenno-cli", "Shitenno-cli"),
    ("ShitennoCli", "ShitennoCli"),
    ("ShitennoCLI", "ShitennoCLI"),
    ("shitenno-cli", "shitenno-cli"),
    ("shitennoCli", "shitennoCli"),
    ("Shitenno-go Dashboard", "Shitenno-go Dashboard"),
    ("ShitennoDashboard", "ShitennoDashboard"),
    ("shitenno-dashboard", "shitenno-dashboard"),
    ("SHITEN", "SHITEN"),
    ("Shiten", "Shiten"),
    ("shiten", "shiten"),
]

PATH_REPLACEMENTS = [
    ("shitenno-go", "shitenno-go"),
    ("Shitenno-go", "Shitenno-go"),
    ("shitenno-cli", "shitenno-cli"),
    ("Shitenno-cli", "Shitenno-cli"),
    ("shitenno-dashboard", "shitenno-dashboard"),
    ("ShitennoDashboard", "ShitennoDashboard"),
    ("SHITEN", "SHITEN"),
    ("Shiten", "Shiten"),
    ("shiten", "shiten"),
]


def replace_content(root, dry_run):
    changed = []
    skipped = []
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        for fname in filenames:
            fpath = os.path.join(dirpath, fname)
            ext = os.path.splitext(fname)[1].lower()
            if fname in SKIP_FILES or ext in SKIP_EXT:
                skipped.append(fpath)
                continue
            try:
                with open(fpath, "r", encoding="utf-8") as f:
                    content = f.read()
            except (UnicodeDecodeError, IsADirectoryError, OSError):
                skipped.append(fpath)
                continue
            original = content
            for old, new in CONTENT_REPLACEMENTS:
                content = content.replace(old, new)
            if content != original:
                changed.append(fpath)
                if not dry_run:
                    with open(fpath, "w", encoding="utf-8") as f:
                        f.write(content)
    return changed, skipped


def new_name(name):
    for old, new in PATH_REPLACEMENTS:
        name = name.replace(old, new)
    return name


def rename_paths(root, dry_run):
    renamed = []
    for dirpath, dirnames, filenames in os.walk(root, topdown=False):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        if any(part in SKIP_DIRS for part in dirpath.split(os.sep)):
            continue
        for fname in filenames:
            nn = new_name(fname)
            if nn != fname:
                src = os.path.join(dirpath, fname)
                dst = os.path.join(dirpath, nn)
                renamed.append((src, dst))
                if not dry_run:
                    os.rename(src, dst)
        for dname in list(dirnames):
            nn = new_name(dname)
            if nn != dname:
                src = os.path.join(dirpath, dname)
                dst = os.path.join(dirpath, nn)
                renamed.append((src, dst))
                if not dry_run:
                    os.rename(src, dst)
    return renamed


def verify(root):
    remaining = []
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        for fname in filenames:
            if fname in SKIP_FILES:
                continue
            fpath = os.path.join(dirpath, fname)
            if "shiten" in fname.lower():
                remaining.append(f"NOME: {fpath}")
                continue
            ext = os.path.splitext(fname)[1].lower()
            if ext in SKIP_EXT:
                continue
            try:
                with open(fpath, "r", encoding="utf-8") as f:
                    content = f.read()
            except (UnicodeDecodeError, IsADirectoryError, OSError):
                continue
            if "shiten" in content.lower():
                remaining.append(f"CONTEUDO: {fpath}")
    return remaining


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("root", help="Caminho raiz do repositório")
    parser.add_argument("--dry-run", action="store_true", help="Só mostra o que mudaria, sem escrever nada")
    args = parser.parse_args()

    root = os.path.abspath(args.root)
    if not os.path.isdir(root):
        print(f"Erro: {root} não é um diretório válido")
        sys.exit(1)

    print(f"Rodando em: {root} {'(dry-run)' if args.dry_run else ''}\n")

    changed, skipped = replace_content(root, args.dry_run)
    print(f"Conteúdo alterado em {len(changed)} arquivo(s)")

    renamed = rename_paths(root, args.dry_run)
    print(f"Renomeados {len(renamed)} arquivo(s)/pasta(s)")
    for s, d in renamed:
        print(f"  {os.path.relpath(s, root)} -> {os.path.relpath(d, root)}")

    if not args.dry_run:
        remaining = verify(root)
        print(f"\nVerificação final: {len(remaining)} referência(s) residual(is) a 'shiten'")
        for r in remaining:
            print(f"  {r}")
        if not remaining:
            print("OK: nenhuma referência restante (fora de pnpm-lock.yaml, que precisa de `pnpm install`).")


if __name__ == "__main__":
    main()
