import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import LoginScreen from "../screens/auth/LoginScreen";
import SignUpScreen from "../screens/auth/SignUpScreen";

export type AuthStackParamList = {
  Login: undefined;
  SignUp: undefined;
};

const Stack = createNativeStackNavigator<AuthStackParamList>();

export default function AuthNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: "#FFD400" },
        headerTintColor: "#000000",
        headerTitleStyle: { fontWeight: "800" },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="Login" component={LoginScreen} options={{ title: "Sign in" }} />
      <Stack.Screen name="SignUp" component={SignUpScreen} options={{ title: "Create account" }} />
    </Stack.Navigator>
  );
}
