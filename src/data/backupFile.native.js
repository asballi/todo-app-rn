import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';

// Mobil: yedek geçici klasöre yazılır ve paylaşım menüsüyle (Dosyalar, Drive,
// e-posta…) kaydedilir; içe aktarmak için dosya seçici açılır.

export async function saveBackupFile(name, text) {
  const file = new File(Paths.cache, name);
  if (file.exists) file.delete();
  file.create();
  file.write(text);
  await Sharing.shareAsync(file.uri, { mimeType: 'application/json', UTI: 'public.json' });
}

// Seçilen dosyanın metni; vazgeçilirse null.
export async function pickBackupFile() {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/json', 'text/plain', '*/*'],
    copyToCacheDirectory: true,
  });
  if (result.canceled || !result.assets?.length) return null;
  return new File(result.assets[0].uri).text();
}
