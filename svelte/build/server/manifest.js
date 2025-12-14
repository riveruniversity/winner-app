const manifest = (() => {
function __memo(fn) {
	let value;
	return () => value ??= (value = fn());
}

return {
	appDir: "_app",
	appPath: "_app",
	assets: new Set([]),
	mimeTypes: {},
	_: {
		client: {start:"_app/immutable/entry/start.BE35C2jd.js",app:"_app/immutable/entry/app.BjbdFVWj.js",imports:["_app/immutable/entry/start.BE35C2jd.js","_app/immutable/chunks/CIvhGhIJ.js","_app/immutable/chunks/BnDB5uks.js","_app/immutable/entry/app.BjbdFVWj.js","_app/immutable/chunks/D0WHf5NO.js","_app/immutable/chunks/BnDB5uks.js","_app/immutable/chunks/K-F0D8fa.js","_app/immutable/chunks/C9l5s-G2.js","_app/immutable/chunks/CCWg9zk2.js"],stylesheets:[],fonts:[],uses_env_dynamic_public:false},
		nodes: [
			__memo(() => import('./chunks/0-j3R_dd-Y.js')),
			__memo(() => import('./chunks/1-0mklEFTt.js')),
			__memo(() => import('./chunks/2-CgNxPltK.js'))
		],
		remotes: {
			
		},
		routes: [
			{
				id: "/",
				pattern: /^\/$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 2 },
				endpoint: null
			}
		],
		prerendered_routes: new Set([]),
		matchers: async () => {
			
			return {  };
		},
		server_assets: {}
	}
}
})();

const prerendered = new Set([]);

const base = "";

export { base, manifest, prerendered };
//# sourceMappingURL=manifest.js.map
