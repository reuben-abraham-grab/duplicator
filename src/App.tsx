import { CssBaseline, ThemeProvider, createTheme } from '@mui/material';
import SVGEditor from './components/SVGEditor';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#14532d', // dark green
    },
    secondary: {
      main: '#22c55e', // lighter green for accents
    },
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 16,
        },
      },
    },
  },
});

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <SVGEditor />
    </ThemeProvider>
  );
}

export default App;
