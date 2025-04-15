import { createBrowserRouter } from "react-router-dom";

import { Layout } from "@components/Layout";
import { CategoriesListPage } from "@features/products/pages/CategoriesListPage";
import { CreateProductPage } from "@features/products/pages/CreateProductPage";
import { ProductsListPage } from "@features/products/pages/ProductsListPage";
import { HomePage } from "@pages/HomePage";

import AuthControls from "@components/AuthControls/AuthControls";
import CounterDisplay from "@components/CounterDisplay/CounterDisplay";

type RouteEntry = {
  path: string;
  title: string;
  dynamicPath?: (id: string) => string;
};

type RouteMap = Record<string, RouteEntry>;

export const Route: RouteMap = {
  HOME: {
    path: "/",
    title: "Home",
  },
  PRODUCTS_LIST: {
    path: "/products",
    title: "Products",
  },
  CATEGORIES_LIST: {
    path: "/categories",
    title: "Categories",
  },
  // PRODUCTS_DETAILS: {
  //   path: '/products/:id',
  //   title: 'Products details',
  //   dynamicPath: (id: ProductDto['id']) => `/products/${id}`,
  // },
  CREATE_PRODUCT: {
    path: "/products/create",
    title: "Create product",
  },
  // New routes for the Context API demo components
  CONTEXT_COUNTER_DEMO: {
    path: "/context-counter",
    title: "Context Counter Demo",
  },
  CONTEXT_AUTH_DEMO: {
    path: "/context-auth",
    title: "Context Auth Demo",
  },
} as const;

export const router = createBrowserRouter([
  {
    path: Route.HOME.path,
    element: <Layout />,
    children: [
      {
        path: Route.HOME.path,
        element: <HomePage />,
      },
      {
        path: Route.PRODUCTS_LIST.path,
        element: <ProductsListPage />,
      },
      {
        path: Route.CATEGORIES_LIST.path,
        element: <CategoriesListPage />,
      },
      // {
      //   path: Route.PRODUCTS_DETAILS.path,
      //   element: <ProductDetailsPage />,
      // },
      {
        path: Route.CREATE_PRODUCT.path,
        element: <CreateProductPage />,
      },
      {
        path: Route.CONTEXT_COUNTER_DEMO.path,
        element: <CounterDisplay />,
      },
      {
        path: Route.CONTEXT_AUTH_DEMO.path,
        element: <AuthControls />,
      },
    ],
  },
]);
