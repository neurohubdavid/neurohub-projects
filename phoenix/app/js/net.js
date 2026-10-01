// Network access. Phoenix runs in the browser, so this is the browser's own fetch (the services it talks to allow it).
export const netFetch = (url, init = {}) => fetch(url, init);
