import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { Provider } from "react-redux";
import { RouterProvider } from "react-router-dom";

import { AuthProvider } from "@components/Auth/AuthContext";
import { ThemeProvider } from "@components/Theme/ThemeContext";

import { router } from "./routes";
import { store } from "./store";

import { AppProvider as ContextAppProvider } from "./store/context/AppContext"; // Import the new Context provider

import "./App.css";

const queryClient = new QueryClient();

function App() {
  return (
    <Provider store={store}>
      <ContextAppProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <ThemeProvider>
              <RouterProvider router={router} />
            </ThemeProvider>
          </AuthProvider>
          <ReactQueryDevtools initialIsOpen={true} />
        </QueryClientProvider>
      </ContextAppProvider>
    </Provider>
  );
}

export default App;
