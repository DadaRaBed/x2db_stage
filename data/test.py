import sqlite3
import os

# Remplacez par le chemin vers l'un de vos fichiers .db à tester
DB_PATH = "system.db" 

def test_sqlite_structure(db_path):
    print(f"--- Test de la base de données : {db_path} ---")
    
    if not os.path.exists(db_path):
        print(f"❌ Erreur : Le fichier '{db_path}' n'existe pas.")
        print("💡 Astuce : Modifiez la variable DB_PATH dans ce script pour pointer vers un fichier .db existant.")
        return

    try:
        # 1. Connexion à la base SQLite
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        print("✅ Connexion SQLite réussie.")

        # 2. Récupération de la liste des tables (comme le fait l'API)
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';")
        tables_rows = cursor.fetchall()
        tables = [row[0] for row in tables_rows]
        
        print(f"📊 Tables trouvées ({len(tables)}) : {tables}")

        # 3. Récupération des attributs (colonnes) pour chaque table
        structure = {}
        for table in tables:
            cursor.execute(f"PRAGMA table_info('{table}');")
            columns_info = cursor.fetchall()
            # PRAGMA table_info renvoie : (cid, name, type, notnull, dflt_value, pk)
            # On extrait uniquement le nom de la colonne (index 1)
            columns = [col[1] for col in columns_info]
            structure[table] = columns
            print(f"   -> Table '{table}' attributs : {columns}")

        conn.close()
        
        print("\n✨ Résultat au format JSON (simulant le retour de l'API) :")
        import json
        print(json.dumps({"success": True, "structure": structure}, indent=2, ensure_ascii=False))

    except Exception as e:
        print(f"❌ Erreur lors de l'analyse SQLite : {e}")

if __name__ == "__main__":
    test_sqlite_structure(DB_PATH)
