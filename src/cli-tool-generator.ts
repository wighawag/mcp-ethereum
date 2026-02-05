import {Command} from 'commander';
import {z} from 'zod';
import type {Tool} from './types.js';
import {getChain} from './helpers.js';
import {getClients} from './helpers.js';
import type {ToolEnvironment} from './types.js';

/**
 * Convert Zod schema field to commander.js option definition
 */
function zodFieldToOption(name: string, field: z.ZodTypeAny): string {
	// Handle boolean flags
	if (field instanceof z.ZodBoolean) {
		return `--${name}`;
	}

	// Handle all other types (string, number, union, etc.) - use string option
	return `--${name} <value>`;
}

/**
 * Check if a ZodUnion contains a number type
 */
function unionContainsNumber(field: z.ZodUnion<any>): boolean {
	for (const option of field.options) {
		if (option instanceof z.ZodNumber) {
			return true;
		}
	}
	return false;
}

/**
 * Parse option value based on Zod type
 */
function parseOptionValue(field: z.ZodTypeAny, value: any): any {
	// Handle array types - parse comma-separated values
	if (field instanceof z.ZodArray) {
		if (typeof value === 'string') {
			// Check if array element type is number
			const elementType = field.element;
			const items = value.split(',').map((v) => v.trim());
			if (elementType instanceof z.ZodNumber) {
				return items.map((v) => Number(v));
			}
			return items;
		}
		return value;
	}

	// Handle number types
	if (field instanceof z.ZodNumber) {
		return Number(value);
	}

	// Handle boolean types
	if (field instanceof z.ZodBoolean) {
		return value === true || value === 'true';
	}

	// Handle union types - try to convert to number if the union includes a number type
	if (field instanceof z.ZodUnion) {
		if (unionContainsNumber(field)) {
			// If the value looks like a number, convert it
			const numValue = Number(value);
			if (!isNaN(numValue) && typeof value === 'string' && /^\d+$/.test(value)) {
				return numValue;
			}
		}
		// Otherwise return as-is (likely a literal string like 'latest')
		return value;
	}

	// Default to string
	return value;
}

/**
 * Extract description from Zod schema field
 */
function getFieldDescription(field: z.ZodTypeAny): string {
	const description = (field as any).description;
	return description || 'No description available';
}

/**
 * Check if a Zod field is optional
 */
function isOptionalField(field: z.ZodTypeAny): boolean {
	return field instanceof z.ZodOptional || field.isOptional?.();
}

/**
 * Create a CLI tool environment for executing tools
 */
async function createCliToolEnvironment(
	rpcUrl: string,
	privateKey?: `0x${string}`,
): Promise<ToolEnvironment> {
	const chain = await getChain(rpcUrl);
	const {publicClient, walletClient} = getClients({
		chain,
		privateKey: privateKey as `0x${string}` | undefined,
	});

	return {
		publicClient,
		walletClient,
		sendStatus: async (msg: string) => {
			console.log(`[Status] ${msg}`);
		},
	};
}

/**
 * Parse and validate parameters against Zod schema
 */
async function parseAndValidateParams(
	schema: z.ZodObject<any>,
	options: Record<string, any>,
): Promise<any> {
	try {
		return await schema.parseAsync(options);
	} catch (error) {
		if (error instanceof z.ZodError) {
			console.error('Parameter validation error:');
			for (const err of error.issues) {
				console.error(`  - ${err.path.join('.')}: ${err.message}`);
			}
		}
		throw error;
	}
}

/**
 * Replacer function for JSON.stringify to handle BigInt values
 */
function bigIntReplacer(_key: string, value: any): any {
	if (typeof value === 'bigint') {
		return value.toString();
	}
	return value;
}

/**
 * Format tool result for CLI output
 */
function formatToolResult(result: {
	success: boolean;
	result?: any;
	error?: string;
	stack?: string;
}): void {
	if (result.success) {
		console.log(JSON.stringify(result.result, bigIntReplacer, 2));
	} else {
		console.error('Error:', result.error);
		if (result.stack) {
			console.error('Stack:', result.stack);
		}
		process.exit(1);
	}
}

/**
 * Generate a single tool command from tool definition
 */
export function generateToolCommand(
	program: Command,
	toolName: string,
	tool: Tool<z.ZodObject<any>>,
): void {
	// Get the schema shape
	const shape = tool.schema.shape;

	// Create the command
	const cmd = program.command(toolName).description(tool.description);

	// Add options for each schema field
	for (const [fieldName, field] of Object.entries(shape)) {
		// Unwrap optional fields
		const actualField = isOptionalField(field as z.ZodTypeAny)
			? (field as z.ZodOptional<any>).unwrap()
			: field;
		const optionDef = zodFieldToOption(fieldName, actualField);
		const description = getFieldDescription(actualField);

		// Add the option
		if (isOptionalField(field as z.ZodTypeAny)) {
			cmd.option(optionDef, description);
		} else {
			cmd.requiredOption(optionDef, description);
		}
	}

	// Add --rpc-url option (can override global)
	cmd.option('--rpc-url <url>', 'RPC URL for the Ethereum network (overrides global)');

	// Command action handler
	cmd.action(async (options: Record<string, any>) => {
		try {
			// Get global options (includes --rpc-url from parent)
			const globalOptions = program.opts();

			// Use local --rpc-url if provided, otherwise use global, otherwise use env var (prefixed first, then generic)
			const rpcUrl =
				options.rpcUrl || globalOptions.rpcUrl || process.env.ECLI_RPC_URL || process.env.RPC_URL;

			if (!rpcUrl) {
				console.error(
					'Error: --rpc-url option or ECLI_RPC_URL (or RPC_URL) environment variable is required',
				);
				process.exit(1);
			}

			// Get private key from environment (prefixed first, then generic)
			const privateKey = process.env.ECLI_PRIVATE_KEY || process.env.PRIVATE_KEY;

			// Validate PRIVATE_KEY format if provided
			if (privateKey && !privateKey.startsWith('0x')) {
				console.error('Error: PRIVATE_KEY must start with 0x');
				process.exit(1);
			}

			// Parse and validate parameters against schema
			const params: Record<string, any> = {};

			for (const [fieldName, field] of Object.entries(shape)) {
				const actualField = isOptionalField(field as z.ZodTypeAny)
					? (field as z.ZodOptional<any>).unwrap()
					: field;
				const value = options[fieldName];

				if (value !== undefined) {
					params[fieldName] = parseOptionValue(actualField, value);
				}
			}

			// Validate against schema
			const validatedParams = await parseAndValidateParams(tool.schema, params);

			// Create tool environment
			const env = await createCliToolEnvironment(rpcUrl, privateKey as `0x${string}` | undefined);

			// Execute the tool
			const result = await tool.execute(env, validatedParams);

			// Format and output result
			formatToolResult(result);
		} catch (error) {
			if (error instanceof Error) {
				console.error('Error:', error.message);
				if (error.stack) {
					console.error('Stack:', error.stack);
				}
			} else {
				console.error('Error:', String(error));
			}
			process.exit(1);
		}
	});
}

/**
 * Register all tool commands from a tools object
 */
export function registerAllToolCommands(program: Command, tools: Record<string, Tool>): void {
	for (const [toolName, tool] of Object.entries(tools)) {
		generateToolCommand(program, toolName, tool);
	}
}
