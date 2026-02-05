/**
 * Basic CLI Functionality Tests
 */

import {describe, it, expect} from 'vitest';
import {invokeCliCommand} from '../cli-utils.js';

describe('CLI - Basic Functionality', () => {
	describe('program help', () => {
		it('should show help when no command is specified', async () => {
			const {stdout, exitCode} = await invokeCliCommand([]);

			expect(exitCode).toBe(0);
			expect(stdout).toContain('Usage:');
			expect(stdout).toContain('Options:');
			expect(stdout).toContain('Commands:');
		});

		it('should show help with --help flag', async () => {
			const {stdout, exitCode} = await invokeCliCommand(['--help']);

			expect(exitCode).toBe(0);
			expect(stdout).toContain('Usage:');
			expect(stdout).toContain('Options:');
			expect(stdout).toContain('Commands:');
		});
	});

	describe('program version', () => {
		it('should show version with --version flag', async () => {
			const {stdout, exitCode} = await invokeCliCommand(['--version']);

			expect(exitCode).toBe(0);
			expect(stdout).toMatch(/\d+\.\d+\.\d+/);
		});
	});

	describe('global options', () => {
		it('should accept --rpc-url option', async () => {
			const {stdout, exitCode} = await invokeCliCommand(['--rpc-url', 'http://localhost:8545']);

			expect(exitCode).toBe(0);
			expect(stdout).toContain('Usage:');
		});

		it('should show help with -h flag', async () => {
			const {stdout, exitCode} = await invokeCliCommand(['-h']);

			expect(exitCode).toBe(0);
			expect(stdout).toContain('Usage:');
		});
	});
});
