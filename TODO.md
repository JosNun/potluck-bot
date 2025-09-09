# TODO - Feature Backlog

## Planned Features

- [ ] Enhanced customization options for potluck themes and templates
- [ ] Recurring potluck events scheduling
- [ ] Export potluck data to external calendar systems 

## Completed Features

- [x] Basic potluck management commands
- [x] SQLite database persistence
- [x] User signup/withdrawal functionality
- [x] Integration with Discord's scheduled events feature
- [x] Natural language date parsing with timezone support
- [x] Server-specific timezone configuration
- [x] Comprehensive help command with usage guides
- [x] Discord event sync (RSVPs, descriptions, updates)
- [x] Auto-creation of Discord events from potluck dates

## Notes

- Discord events integration is fully implemented with bidirectional sync
- Bot automatically creates Discord events when dates are provided
- RSVP changes in Discord events sync back to potluck attendance tracking
- Timezone support uses natural language parsing ("6pm EST", "tomorrow at noon")
- Admin users can set server default timezones via `/settimezone` command