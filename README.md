# Painel de Controle NPR

Página estática (HTML + CSS + JS puro, sem build) com botões que copiam textos
padrão para a área de transferência, organizados em seções. Os textos ficam
salvos no `localStorage` do navegador; há exportação/importação de backup em JSON.

## Estrutura

- `index.html` — marcação da página
- `css/style.css` — todo o visual (tokens de cor e tema claro/escuro em `:root`)
- `js/app.js` — toda a lógica (seções, textos, cópia, busca, backup, tema)

Para publicar: **Settings → Pages → Source: branch `main`, pasta `/ (root)`**.
