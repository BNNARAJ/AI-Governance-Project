import chromadb
import json
import os

path = r'c:\Users\bnnar\Desktop\AI Governance Project\backend\data\chroma_db'
client = chromadb.PersistentClient(path=path)
cols = client.list_collections()

output_path = r'C:\Users\bnnar\.gemini\antigravity\brain\09b05dfd-c355-4842-a964-84b5b38d55dc\rag_chunks_view.md'

with open(output_path, 'w', encoding='utf-8') as f:
    f.write('# ChromaDB Vector Store Data (RAG Chunks)\n\n')
    f.write('Here is a raw view of how the regulations PDF was chunked and stored alongside its metadata before being turned into vector embeddings.\n\n')
    
    if not cols:
        f.write('No collections found!')
    else:
        col = cols[0]
        data = col.peek(limit=5)
        docs = data.get('documents', [])
        metas = data.get('metadatas', [])
        ids = data.get('ids', [])
        
        for i in range(len(docs)):
            f.write(f'### Chunk {i+1}\n')
            f.write(f'**Chunk ID**: `{ids[i]}`\n\n')
            f.write('**Metadata**:\n```json\n')
            f.write(json.dumps(metas[i], indent=2))
            f.write('\n```\n\n')
            f.write('**Document Text Fragment**:\n')
            f.write('> ' + docs[i].replace('\n', '\n> ') + '\n\n')
            f.write('---\n\n')
    print("Done")
