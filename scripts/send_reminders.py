#!/usr/bin/env python3
"""Remind claimed members who haven't finished their 3 picks.

Email via Gmail SMTP (GMAIL_USER / GMAIL_APP_PASSWORD) and web push via
VAPID (VAPID_PRIVATE_KEY) to every subscribed device of each straggler.
Run by .github/workflows/pick-reminders.yml before each week's slates.

--dry-run lists stragglers without sending anything (works with anon key).
"""
import argparse
import os
import smtplib
import ssl
import sys
from email.message import EmailMessage

from season import load_season_config, current_week
from supabase_integration import get_supabase_client, SUPABASE_SERVICE_KEY

SITE_URL = "https://jolsufka.github.io/nfl_spread_league/"


def find_stragglers(week: int, season: int):
    """Claimed members with fewer than 3 picks for the week."""
    supabase = get_supabase_client(write=bool(SUPABASE_SERVICE_KEY))
    members = supabase.table("members").select("player_id,email,auth_uid").execute().data
    picks = (
        supabase.table("picks")
        .select("user_id")
        .eq("season", season)
        .eq("week", week)
        .execute()
        .data
    )
    counts = {}
    for row in picks:
        counts[row["user_id"]] = counts.get(row["user_id"], 0) + 1

    stragglers = []
    for member in members:
        if not member.get("auth_uid"):
            continue  # unclaimed — nothing to remind, no address to use
        picked = counts.get(member["player_id"], 0)
        if picked < 3:
            stragglers.append({**member, "picked": picked})
    return stragglers


def send_emails(stragglers, week):
    user = os.environ.get("GMAIL_USER")
    password = os.environ.get("GMAIL_APP_PASSWORD")
    if not user or not password:
        print("GMAIL_USER / GMAIL_APP_PASSWORD not set - skipping email")
        return
    with smtplib.SMTP_SSL("smtp.gmail.com", 465, context=ssl.create_default_context()) as smtp:
        smtp.login(user, password)
        for member in stragglers:
            if not member.get("email"):
                continue
            missing = 3 - member["picked"]
            message = EmailMessage()
            message["Subject"] = f"⏰ Lutes Pick 'Em: {missing} pick{'s' if missing != 1 else ''} still open for Week {week}"
            message["From"] = f"Lutes Pick 'Em <{user}>"
            message["To"] = member["email"]
            message.set_content(
                f"You have {member['picked']}/3 picks in for Week {week}.\n\n"
                f"Lock in the rest before kickoff: {SITE_URL}#/picks\n\n"
                "— Lutes Pick 'Em"
            )
            smtp.send_message(message)
            print(f"emailed {member['player_id']} ({member['email']})")


def send_pushes(stragglers, week):
    private_key = os.environ.get("VAPID_PRIVATE_KEY")
    if not private_key:
        print("VAPID_PRIVATE_KEY not set - skipping push")
        return
    if not SUPABASE_SERVICE_KEY:
        print("SUPABASE_SERVICE_KEY not set - skipping push (subscriptions unreadable)")
        return
    try:
        from pywebpush import webpush, WebPushException
    except ImportError:
        print("pywebpush not installed - skipping push")
        return
    import json
    import tempfile

    with tempfile.NamedTemporaryFile("w", suffix=".pem", delete=False) as pem:
        pem.write(private_key)
        pem_path = pem.name

    supabase = get_supabase_client(write=True)
    straggler_ids = [member["player_id"] for member in stragglers]
    subscriptions = (
        supabase.table("push_subscriptions")
        .select("id,player_id,endpoint,p256dh,auth")
        .in_("player_id", straggler_ids)
        .execute()
        .data
    )
    for subscription in subscriptions:
        payload = json.dumps({
            "title": "Lutes Pick 'Em ⏰",
            "body": f"Picks are still open for Week {week} — lock them in before kickoff!",
            "url": SITE_URL,
        })
        try:
            webpush(
                subscription_info={
                    "endpoint": subscription["endpoint"],
                    "keys": {"p256dh": subscription["p256dh"], "auth": subscription["auth"]},
                },
                data=payload,
                vapid_private_key=pem_path,
                vapid_claims={"sub": "mailto:jacob.olsufka@gmail.com"},
            )
            print(f"pushed to {subscription['player_id']} device")
        except WebPushException as error:
            status = getattr(error.response, "status_code", None)
            if status in (404, 410):
                supabase.table("push_subscriptions").delete().eq("id", subscription["id"]).execute()
                print(f"pruned dead subscription for {subscription['player_id']}")
            else:
                print(f"push failed for {subscription['player_id']}: {error}")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    config = load_season_config()
    week = current_week(config)
    season = config["season"]

    stragglers = find_stragglers(week, season)
    if not stragglers:
        print(f"Week {week}: everyone's picks are in. No reminders needed.")
        return
    print(f"Week {week} stragglers: " + ", ".join(
        f"{member['player_id']} ({member['picked']}/3)" for member in stragglers
    ))
    if args.dry_run:
        print("--dry-run: nothing sent")
        return

    send_emails(stragglers, week)
    send_pushes(stragglers, week)


if __name__ == "__main__":
    main()
