# CORS
Turns out grabbing binary data from `cdn.discordapp.com` makes CORS really mad! See `README.md` for more info on why.

## browser extension patching
I've removed support for fixing CORS via `patch.diff` simply because I don't want to deal with more patching than necessary (browser extensions allow CORS patching). However if you're interested in doing that anyways, then go into `browser/` and look below.

### manifest v3
#### `manifest.json`
Add `"https://cdn.discordapp.com/attachments/*"` under `"host_permissions"`.

### `background.js`
Include the following inside of `chrome.webRequest.onHeadersReceived.addListener`:
```js
if (url.startsWith("https://cdn.discordapp.com/attachments/")) {
    responseHeaders.push({
        name: "Access-Control-Allow-Origin",
        value: "*"
    }, {
        name: "Access-Control-Allow-Methods",
        value: "GET, POST, OPTIONS"
    });
}
```

### manifest v2
#### `manifestv2.json`
Add `"https://cdn.discordapp.com/attachments/*"` under `"permissions"`.

#### `modifyResponseHeaders.json`
Add this object to the root array:
```json
{
    "id": 3,
    "action": {
        "type": "modifyHeaders",
        "responseHeaders": [
            {
                "header": "Access-Control-Allow-Origin",
                "operation": "set",
                "value": "*"
            },
            {
                "header": "Access-Control-Allow-Methods",
                "operation": "set",
                "value": "GET, POST, OPTIONS"
            }
        ]
    },
    "condition": {
        "resourceTypes": ["xmlhttprequest"],
        "urlFilter": "https://cdn.discordapp.com/attachments/*"
    }
}
```
