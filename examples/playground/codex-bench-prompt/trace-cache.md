Trace an initially empty least recently used (LRU) cache with room for three keys. An access is a hit if the key is present. On a miss, insert the key, first evicting the least recently used key if the cache is full. After each access, the accessed key is the most recently used.

Accesses in order: `A B C A D B D E`.

Return two lines. On the first, write eight space-separated outcomes using `hit` or `miss`. On the second, list the three final keys from most to least recently used, separated by spaces.
