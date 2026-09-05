// TS 4.9 with moduleResolution "node" can't read chart-factory's exports map
// for subpath imports; webpack resolves them fine at runtime.
declare module 'chart-factory/table';
