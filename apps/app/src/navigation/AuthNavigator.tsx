import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import LoginScreen from "../screens/auth/LoginScreen";
import PhoneSignInScreen from "../screens/auth/PhoneSignInScreen";
import SignUpScreen from "../screens/auth/SignUpScreen";
import { fonts, semantic } from "../theme";

export type AuthStackParamList = {
  Login: { signedUp?: boolean } | undefined;
  SignUp: undefined;
  PhoneSignIn: undefined;
};

const Stack = createNativeStackNavigator<AuthStackParamList>();

export default function AuthNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: semantic.accentYellow },
        headerTintColor: semantic.textPrimary,
        headerTitleStyle: { fontFamily: fonts.display, fontWeight: "400", fontSize: 18 },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="Login" component={LoginScreen} options={{ title: "Sign in" }} />
      <Stack.Screen name="SignUp" component={SignUpScreen} options={{ title: "Create account" }} />
      <Stack.Screen name="PhoneSignIn" component={PhoneSignInScreen} options={{ title: "Phone sign-in" }} />
    </Stack.Navigator>
  );
}
