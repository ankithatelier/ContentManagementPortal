# exchange_token.py
# Python 3.8+
# pip install requests

import requests
import sys
from urllib.parse import urlencode

# === CONFIG ===
APP_ID = "821851656894541"
APP_SECRET = "15bfabaa61df39b8ada12a00d29031da"
SHORT_LIVED_TOKEN = "EAALreEAROE0BP3AMzCSTajBG9uu6Rx4ZBjW0bG6OQCX2jn2m4ypxvEUSVaIiAaNUtZAyHfYSQn2v83lPIieWO9yYUnJGSQOIPEccfLstW9tFZBYVZAXTVKKWttbHSYDhTIO9JGCpnR1BRB922PlN1S8tZBBhSG4mNTwJID4oTzVPlE74m5lgBJfaiwKA65wThAqotXX3ZB0xglXEWx0Rg1tlsIP5A6dyZBn0PnqZAwZDZD"   # the token you already have
PAGE_ID = "220015244526738"                       # if you want a page token

def get_long_lived_user_token(app_id, app_secret, short_token):
    url = "https://graph.facebook.com/v17.0/oauth/access_token"
    params = {
        "grant_type": "fb_exchange_token",
        "client_id": app_id,
        "client_secret": app_secret,
        "fb_exchange_token": short_token,
    }
    r = requests.get(url, params=params, timeout=10)
    r.raise_for_status()
    return r.json()  # usually contains access_token and expires_in

# === 2) (Optional) Exchange long-lived user token for a Page access token (permanent) ===
def get_page_access_token(page_id, long_lived_user_token):
    url = f"https://graph.facebook.com/v17.0/{page_id}"
    params = {
        "fields": "access_token",
        "access_token": long_lived_user_token
    }
    r = requests.get(url, params=params, timeout=10)
    r.raise_for_status()
    return r.json()  # contains "access_token" for the page

if __name__ == "__main__":
    # 1. long-lived user token
    try:
        print("Exchanging short-lived token for long-lived user token...")
        long_token_resp = get_long_lived_user_token(APP_ID, APP_SECRET, SHORT_LIVED_TOKEN)
        long_user_token = long_token_resp.get("access_token")
        expires_in = long_token_resp.get("expires_in")
        print("Long-lived user token:", long_user_token)
        print("Expires in (seconds):", expires_in)
    except requests.HTTPError as e:
        print("Failed to get long-lived user token:", e, file=sys.stderr)
        print("Response:", e.response.text if e.response is not None else "no response", file=sys.stderr)
        sys.exit(1)

    # 2. page token (permanent) — only if you need a page token
    if PAGE_ID and long_user_token:
        try:
            print("\nRequesting page access token (this is the token you can use for page actions)...")
            page_resp = get_page_access_token(PAGE_ID, long_user_token)
            page_token = page_resp.get("access_token")
            print("Page access token:", page_token)
            # Page tokens from this call are often permanent (no expiry) for pages owned by the user.
        except requests.HTTPError as e:
            print("Failed to get page token:", e, file=sys.stderr)
            print("Response:", e.response.text if e.response is not None else "no response", file=sys.stderr)
            sys.exit(1)
    else:
        print("\nNo PAGE_ID set or missing long-lived user token — skipping page token step.")