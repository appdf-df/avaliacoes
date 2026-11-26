#!/bin/zsh
# Executa os testes do servidor no macOS (JavaScript nativo via osascript),
# simulando a planilha.
set -e
DIR="${0:A:h}"
RAIZ="$DIR/.."
TMP="$(mktemp -d)"
cat "$DIR/simulador_gas.js" "$RAIZ"/src/*.gs "$DIR/testes.js" > "$TMP/teste.js"
osascript -l JavaScript "$TMP/teste.js" > "$TMP/saida.txt"
sed -n '1,/^===CONSOLIDADO===$/p' "$TMP/saida.txt" | sed '$d'
rm -rf "$TMP"
