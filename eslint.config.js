import antfu from '@antfu/eslint-config'

export default antfu({
  unocss: true,
  svelte: true,
  solid: true,
  rules: {
    'no-console': 'warn',
    'curly': ['warn', 'multi-or-nest', 'consistent'],
    'antfu/no-top-level-await': 'off',
  },
})
