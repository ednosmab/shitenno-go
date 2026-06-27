# 📱 SKILL: RESPONSIVIDADE CROSS-PLATFORM

## 🎯 Objetivo
Entregar uma interface que se adapta perfeitamente a diferentes tamanhos de tela (Mobile, Tablet, Desktop) com um único código-base.

## 📏 Regras de Adaptabilidade
1. **Breakpoints Consistentes:** Defina e use um conjunto padrão de breakpoints (`sm`, `md`, `lg`) consistentemente em todos os componentes, em vez de valores ad-hoc por tela.
2. **Layouts Flexíveis:** Prefira `flex: 1` e `flexWrap: wrap` em vez de larguras fixas em pixels.
3. **Imagens Responsivas:** Utilize propriedades de `objectFit` e garanta que as mídias não quebrem o layout em telas pequenas.
4. **Interações Específicas:** 
   - **Touch:** Elementos de toque devem ter áreas mínimas de 44px.
   - **Mouse:** Adicione feedbacks de cursor e hovers apenas para dispositivos que suportam ponteiro.
5. **Adaptação de Conteúdo:** Oculte ou mova elementos secundários em telas pequenas para manter o foco no conteúdo principal.
