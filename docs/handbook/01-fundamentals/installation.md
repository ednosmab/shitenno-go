# Instalação

> Como instalar o Nexus no seu ambiente.

---

## Pré-requisitos

- **Node.js** >= 18.0.0
- **npm** (vem com Node.js)
- **Git** (opcional, mas recomendado para detecção de branch)

Verifique sua versão:

```bash
node --version   # Deve mostrar v18.x ou superior
npm --version
git --version    # Opcional
```

---

## Método 1: Instalação Global (recomendado)

Instala o `nexus` como comando global no sistema:

```bash
npm install -g nexus-system
```

Após instalar, execute:

```bash
nexus --version
```

Se mostrar a versão, está tudo certo.

---

## Método 2: Instalação Local (por projeto)

Instala o `nexus` como dependência do projeto:

```bash
cd seu-projeto
npm install nexus-system
```

Para usar:

```bash
npx nexus --version
```

---

## Método 3: Do código fonte (desenvolvimento)

Para contribuir ou usar a versão mais recente:

```bash
# Clone o repositório
git clone https://github.com/ednosmab/nexus-system.git
cd nexus-system

# Instale dependências
pnpm install

# Compile
pnpm build

# Teste
npx nexus --version
```

---

## Verificação

Após a instalação, verifique se tudo funciona:

```bash
nexus --version
```

Saída esperada:

```
0.1.0
```

---

## Primeira inicialização

Navegue até seu projeto e execute:

```bash
cd seu-projeto
nexus init
```

O Nexus irá:

1. Analisar seu projeto (stack, packages, estrutura)
2. Fazer perguntas sobre maturidade
3. Calcular seu perfil de maturidade
4. Instalar capabilities recomendadas
5. Criar a pasta `nexus-system/`

→ Veja [Primeiros Passos](quick-start.md) para detalhes.

---

## Solução de problemas

### "nexus: command not found"

Se instalou globalmente, verifique o PATH:

```bash
npm bin -g
```

Adicione o resultado ao seu PATH se necessário.

### "Permission denied"

Use `sudo` (Linux/Mac):

```bash
sudo npm install -g nexus-system
```

Ou configure npm para não precisar de sudo:

```bash
npm config set prefix ~/.npm-global
```

### "Node.js version not supported"

Atualize o Node.js para versão >= 18.0.0:

```bash
# Com nvm
nvm install 18
nvm use 18
```

---

## Próximo passo

→ [Primeiros Passos](quick-start.md)
