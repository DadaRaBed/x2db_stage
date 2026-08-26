from excel_service import ExcelService  # (remplacez par le nom de votre fichier .py)

service = ExcelService()

# Testez la récupération des feuilles (remplacez par le chemin de votre vrai fichier)
sheets = service.get_sheets("/home/nabory/Documents/hello.xlsx")
print("Feuilles trouvées :", sheets)