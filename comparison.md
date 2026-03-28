# Feature Comparison

Comparison of ryanbr/TwitchAdSolutions (release & testing) vs GosuDRM/TTV-AB 5.0.6.

## Ad Detection

| Feature | Release | Testing | TTV-AB |
|---|---|---|---|
| Multiple ad signifiers | Yes (5) | Yes (5) | Yes (6 + URL patterns) |
| SCTE-35 CUE-OUT/CUE-IN | Yes | Yes | Yes |

## Backup Stream

| Feature | Release | Testing | TTV-AB |
|---|---|---|---|
| Backup player type cycling | Yes | Yes | Yes |
| Failed backup type tracking | PR | Yes | Yes |
| Pinned backup type | PR | Yes (opt-in) | Yes (always on) |
| Segment recovery cache | PR | Yes | Yes |

## Ad Recovery

| Feature | Release | Testing | TTV-AB |
|---|---|---|---|
| Ad-end grace period | PR | Yes | Yes |
| Dead backup detection | PR | Yes | No |
| Post-ad resume retry | PR | Yes | Yes |
| Muted state restore | PR | Yes | Yes |
| Player error auto-recovery | No | Yes | Yes |

## Player Stability

| Feature | Release | Testing | TTV-AB |
|---|---|---|---|
| Visibility/hidden override | Yes | Yes | Yes |
| hasFocus override | Yes | Yes | No |
| Tab focus auto-play | Yes | Yes | Yes |
| Buffering monitor | Yes | Yes | Yes |
| Quality/volume restore | Yes | Yes | Yes |
| Playback intent tracking | No | No | Yes |
| Stale event filtering | No | No | Yes |
| Worker crash recovery | No | No | Yes |

## Configuration

| Feature | Release | Testing | TTV-AB |
|---|---|---|---|
| ReloadPlayerAfterAd | Yes | Yes | N/A |
| ForceAccessTokenPlayerType | Yes | Yes | N/A |
| PinBackupPlayerType | PR | Yes | Always on |
| Config logged on load | Yes | Yes | No |

## Debug Logging

| Feature | Release | Testing | TTV-AB |
|---|---|---|---|
| AD DEBUG breakpoints | Yes (15+) | Yes (15+) | Minimal |
| Worker rejection logging | Yes | Yes | No |
| GQL header capture log | Yes | Yes | No |
| Stripped segment count | Yes | Yes | No |

## Null Safety

| Feature | Release | Testing | TTV-AB |
|---|---|---|---|
| Optional chaining | Yes | Yes | Yes |
| GQL response validation | Yes | Yes | Yes |

## Compatibility

| Feature | Release | Testing | TTV-AB |
|---|---|---|---|
| WebKit/iOS | Yes | Yes | N/A |
| Firefox | Yes | Yes | Yes |
| Chrome | Yes | Yes | Yes |
