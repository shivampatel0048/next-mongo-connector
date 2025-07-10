/**
 * Webpack configuration for Next MongoDB Connector
 * Handles optional dependencies and native modules automatically
 */

import path from 'path';

type ExternalHandler = (
    context: { context: string; request: string; contextInfo: { issuer: string } },
    callback: (error?: Error | null, result?: string) => void
) => void;

interface ResolveConfig {
    fallback?: Record<string, boolean | string>;
    alias?: Record<string, string>;
}

interface ModuleRule {
    test?: RegExp;
    use?: string | { loader: string; options?: any };
    resolve?: { fallback: Record<string, string | false> };
    exclude?: RegExp | RegExp[];
    loader?: string;
    options?: any;
}

interface ModuleConfig {
    rules?: ModuleRule[];
    noParse?: RegExp[];
}

interface WebpackConfig {
    resolve?: ResolveConfig;
    module?: ModuleConfig;
    ignoreWarnings?: Array<RegExp | { module?: RegExp; message?: RegExp }>;
    externals?: Array<string | Record<string, string> | ExternalHandler>;
    optimization?: {
        nodeEnv?: boolean;
    };
    node?: {
        __dirname?: boolean;
        __filename?: boolean;
        [key: string]: boolean | undefined;
    };
}

interface NextConfig {
    webpack?: (config: any, context: any) => any;
    reactStrictMode?: boolean;
    poweredByHeader?: boolean;
    [key: string]: any;
}

const OPTIONAL_DEPENDENCIES = [
    'aws4',
    'mongodb-client-encryption',
    'kerberos',
    'saslprep',
    'snappy',
    'bson-ext',
    '@mongodb-js/zstd',
    'mongodb-client-encryption',
    'redis',
    '@aws-sdk/credential-providers',
] as const;

const NATIVE_MODULES = [
    ...OPTIONAL_DEPENDENCIES,
    /kerberos[\\/]build[\\/]Release[\\/]kerberos\.node$/,
    /mongodb-client-encryption[\\/]build[\\/]Release[\\/]mongodb_client_encryption\.node$/,
    /bson-ext[\\/]build[\\/]Release[\\/]bson\.node$/
];

// Get the correct path to the empty module based on the module format
const getEmptyModulePath = (isCommonJS: boolean) => {
    // Use a relative path that will work in the built package
    const ext = isCommonJS ? 'js' : 'mjs';
    return path.join(__dirname, `empty-module.${ext}`);
};

/**
 * Creates a webpack configuration for handling MongoDB optional dependencies
 * @param config Base webpack configuration
 * @returns Modified webpack configuration
 */
function createMongoWebpackConfig(baseConfig: WebpackConfig = {}): WebpackConfig {
    const result: WebpackConfig = {
        resolve: {
            fallback: { ...baseConfig.resolve?.fallback },
            alias: { ...baseConfig.resolve?.alias }
        },
        module: {
            rules: [...(baseConfig.module?.rules || [])],
            noParse: [...(baseConfig.module?.noParse || [])]
        },
        ignoreWarnings: [...(baseConfig.ignoreWarnings || [])],
        externals: [...(baseConfig.externals || [])]
    };

    // Handle optional dependencies
    for (const dep of OPTIONAL_DEPENDENCIES) {
        if (!result.resolve!.alias) result.resolve!.alias = {};
        result.resolve!.alias[dep] = getEmptyModulePath(true);
    }

    // Handle .node native modules
    result.module!.rules!.push({
        test: /\.node$/,
        use: {
            loader: 'node-loader',
            options: {
                name: '[name].[ext]'
            }
        }
    });

    // Additional rule for handling binary modules
    result.module!.rules!.push({
        test: /\.(node|dll)$/,
        use: 'null-loader'
    });

    // Suppress warnings for optional dependencies
    result.ignoreWarnings!.push(
        ...OPTIONAL_DEPENDENCIES.map(dep => new RegExp(`Can't resolve '${dep}'`)),
        /Critical dependency/,
        /The request of a dependency is an expression/
    );

    return result;
}

/**
 * Creates a Next.js configuration with MongoDB-friendly webpack settings
 */
export function createNextConfig(customConfig: NextConfig = {}): NextConfig {
    const mongoConfig = createMongoWebpackConfig();

    return {
        ...customConfig,
        webpack: (config: any, context: any) => {
            // First run the user's webpack config if they have one
            if (typeof customConfig.webpack === 'function') {
                config = customConfig.webpack(config, context);
            }

            // Then apply our MongoDB-specific config
            if (!config.resolve) config.resolve = {};
            if (!config.resolve.fallback) config.resolve.fallback = {};
            if (!config.resolve.alias) config.resolve.alias = {};
            if (!config.module) config.module = {};
            if (!config.module.rules) config.module.rules = [];
            if (!config.ignoreWarnings) config.ignoreWarnings = [];

            // Merge in our MongoDB configs
            Object.assign(config.resolve.fallback, mongoConfig.resolve?.fallback);
            Object.assign(config.resolve.alias, mongoConfig.resolve?.alias);
            config.module.rules.push(...(mongoConfig.module?.rules || []));
            config.ignoreWarnings.push(...(mongoConfig.ignoreWarnings || []));

            return config;
        }
    };
}

// For backwards compatibility
export { createNextConfig as createMongoWebpackConfig };