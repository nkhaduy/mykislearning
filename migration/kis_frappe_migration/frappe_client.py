import json
import urllib.parse
import urllib.request

from .importer import UpsertResult


class RestFrappeClient:
    def __init__(self, base_url: str, api_key: str, api_secret: str):
        self.base_url = base_url.rstrip("/")
        self.headers = {
            "Authorization": f"token {api_key}:{api_secret}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

    def _request(self, method: str, path: str, payload: dict | None = None) -> dict:
        body = json.dumps(payload).encode() if payload is not None else None
        request = urllib.request.Request(self.base_url + path, data=body, headers=self.headers, method=method)
        with urllib.request.urlopen(request, timeout=60) as response:
            return json.load(response)

    def upsert(self, doctype: str, legacy_id: str, payload: dict) -> UpsertResult:
        filters = json.dumps([["custom_kis_legacy_id", "=", legacy_id]])
        query = urllib.parse.urlencode({"filters": filters, "fields": json.dumps(["name"]), "limit_page_length": 1})
        resource = "/api/resource/" + urllib.parse.quote(doctype, safe="")
        found = self._request("GET", f"{resource}?{query}").get("data", [])
        document = {**payload, "custom_kis_legacy_id": legacy_id}
        if found:
            name = urllib.parse.quote(found[0]["name"], safe="")
            self._request("PUT", f"{resource}/{name}", document)
            return UpsertResult(action="updated", name=found[0]["name"])
        response = self._request("POST", resource, document)
        return UpsertResult(action="created", name=response["data"]["name"])
