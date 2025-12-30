import { describe, it, expect } from 'vitest';
import plugin, {
	languages,
	parsers,
	printers,
	options,
	defaultOptions,
} from '../src/index.js';

describe('index', () => {
	describe('plugin structure', () => {
		it('should export a plugin object', () => {
			expect(plugin).toBeDefined();
			expect(typeof plugin).toBe('object');
		});

		it('should have languages property', () => {
			expect(plugin.languages).toBeDefined();
			expect(languages).toBeDefined();
			expect(plugin.languages).toBe(languages);
		});

		it('should have parsers property', () => {
			expect(plugin.parsers).toBeDefined();
			expect(parsers).toBeDefined();
			expect(plugin.parsers).toBe(parsers);
		});

		it('should have printers property', () => {
			expect(plugin.printers).toBeDefined();
			expect(printers).toBeDefined();
			expect(plugin.printers).toBe(printers);
		});

		it('should have options property', () => {
			expect(plugin.options).toBeDefined();
			expect(options).toBeDefined();
			expect(plugin.options).toBe(options);
		});

		it('should have defaultOptions property', () => {
			expect(plugin.defaultOptions).toBeDefined();
			expect(defaultOptions).toBeDefined();
			expect(plugin.defaultOptions).toBe(defaultOptions);
		});

		it('should have apex printer', () => {
			expect(plugin.printers.apex).toBeDefined();
			expect(typeof plugin.printers.apex.print).toBe('function');
		});
	});

	describe('named exports', () => {
		it('should export languages as named export', () => {
			expect(languages).toBe(plugin.languages);
		});

		it('should export parsers as named export', () => {
			expect(parsers).toBe(plugin.parsers);
		});

		it('should export printers as named export', () => {
			expect(printers).toBe(plugin.printers);
		});

		it('should export options as named export', () => {
			expect(options).toBe(plugin.options);
		});

		it('should export defaultOptions as named export', () => {
			expect(defaultOptions).toBe(plugin.defaultOptions);
		});
	});
});
