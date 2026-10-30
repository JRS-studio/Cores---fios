import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View, type ViewStyle } from 'react-native';

type Props = {
  color: string;
  width?: number;
  height?: number;
  style?: ViewStyle;
};

// Unha estilizada (formato amendoado) com brilho, usada em amostras de esmalte.
export function Nail({ color, width = 34, height = 46, style }: Props) {
  return (
    <View
      style={[
        styles.nail,
        { width, height, backgroundColor: color, borderTopLeftRadius: width / 2, borderTopRightRadius: width / 2 },
        style,
      ]}
    >
      <LinearGradient
        colors={['rgba(255,255,255,0.55)', 'rgba(255,255,255,0)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.shine, { width: width * 0.28, height: height * 0.55, borderRadius: width }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  nail: {
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  shine: {
    position: 'absolute',
    top: '12%',
    left: '18%',
  },
});
