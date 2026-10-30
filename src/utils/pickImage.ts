import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';

// Abre câmera ou galeria já pedindo permissão; devolve null se a pessoa desistir.
export async function pickImage(fromCamera: boolean, aspect: [number, number] = [4, 5]) {
  const permission = fromCamera
    ? await ImagePicker.requestCameraPermissionsAsync()
    : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    Alert.alert(
      'Permissão necessária',
      fromCamera ? 'Libere o acesso à câmera nas configurações do celular.' : 'Libere o acesso às fotos nas configurações do celular.',
    );
    return null;
  }
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], allowsEditing: true, aspect, quality: 0.8 };
  const result = fromCamera ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
  return result.canceled ? null : result.assets[0];
}
