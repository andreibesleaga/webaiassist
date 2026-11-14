# Graph fixtures

Files recorded from the live nodes on 14 Nov 2026 with a normal browser User-Agent (curl, GET), unchanged:
`asc-*` from <https://agenticsystemcore.com> (linkset, `graph.jsonld`, `chunks.jsonl`) and `pat-*` from
<https://patterns.agenticsystemcore.com> (linkset, `graph.jsonld`). Every digest in the linksets matches the
bytes of the files here. Tests read these files and never the network. They are kept byte for byte
(`.prettierignore`).
