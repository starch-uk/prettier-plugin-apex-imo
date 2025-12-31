import parser from '@typescript-eslint/parser';
import plugin from '@typescript-eslint/eslint-plugin';

// Get all available configs from the plugin
const recommendedConfig = plugin.configs.recommended || {};
const strictConfig = plugin.configs.strict || {};
const stylisticConfig = plugin.configs.stylistic || {};
const recommendedTypeCheckedConfig =
	plugin.configs['recommended-type-checked'] ||
	plugin.configs.recommendedTypeChecked ||
	{};
const strictTypeCheckedConfig =
	plugin.configs['strict-type-checked'] ||
	plugin.configs.strictTypeChecked ||
	{};

// Enable all rules from all configs
const configRules = {
	// Enable all TypeScript ESLint recommended rules
	...(recommendedConfig.rules || {}),
	// Enable all TypeScript ESLint strict rules
	...(strictConfig.rules || {}),
	// Enable all TypeScript ESLint stylistic rules
	...(stylisticConfig.rules || {}),
	// Enable all TypeScript ESLint type-checked rules
	...(recommendedTypeCheckedConfig.rules || {}),
	...(strictTypeCheckedConfig.rules || {}),
};

// Enable all individual rules from the plugin that aren't in configs
// This ensures every rule is enabled, not just those in presets
const allPluginRules = {};
if (plugin.rules) {
	for (const [ruleName, rule] of Object.entries(plugin.rules)) {
		const fullRuleName = `@typescript-eslint/${ruleName}`;
		// Only enable if not already set by a config (configs take precedence)
		if (!(fullRuleName in configRules)) {
			// Enable the rule (use 'error' as default, can be overridden)
			allPluginRules[fullRuleName] = 'error';
		}
	}
}

// Combine all rules
const allRules = {
	// Disable base ESLint rules that conflict with TypeScript versions
	'no-unused-vars': 'off',
	'no-redeclare': 'off',
	'no-undef': 'off',
	// All rules from configs
	...configRules,
	// All individual plugin rules not in configs
	...allPluginRules,
	// Customize specific rules (these override any config defaults)
	'@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
};

export default [
	{
		files: ['**/*.ts'],
		languageOptions: {
			parser,
			parserOptions: {
				ecmaVersion: 2022,
				sourceType: 'module',
				project: ['./tsconfig.eslint.json'],
			},
		},
		plugins: {
			'@typescript-eslint': plugin,
		},
		rules: allRules,
	},
	{
		ignores: ['dist/**', 'node_modules/**', 'coverage/**'],
	},
];
