from server.algos.animeai import animeai_algo

algos = {
    'animeai': lambda cursor=None, limit=20: {
        'feed': [{'uri': uri, 'cid': 'fake-cid'} for uri in animeai_algo(cursor, limit)]
    }
}
