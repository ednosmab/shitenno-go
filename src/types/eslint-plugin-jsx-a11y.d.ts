declare module "eslint-plugin-jsx-a11y" {
  const plugin: {
    configs: {
      recommended: {
        rules: Record<string, unknown>;
      };
    };
  };
  export default plugin;
}
