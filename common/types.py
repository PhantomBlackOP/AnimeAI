# common/types.py
from dataclasses import dataclass

@dataclass
class Post:
    uri: str
    cid: str
    text: str
