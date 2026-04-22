import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import SignInLandingScreen from "../screens/auth/SignInLandingScreen";
import EmailSignInScreen from "../screens/auth/EmailSignInScreen";
import SignUpLandingScreen from "../screens/auth/SignUpLandingScreen";
import EmailSignUpScreen from "../screens/auth/EmailSignUpScreen";
import RequestPasswordResetScreen from "../screens/auth/RequestPasswordResetScreen";
import SetNewPasswordScreen from "../screens/auth/SetNewPasswordScreen";
import { fonts, semantic } from "../theme";

export type AuthStackParamList = {
  SignInLanding: { signedUp?: boolean; passwordReset?: boolean } | undefined;
  EmailSignIn: { signedUp?: boolean } | undefined;
  SignUpLanding: undefined;
  EmailSignUp: undefined;
  RequestPasswordReset: undefined;
  SetNewPassword: undefined;
};

type Props = {
  initialRoute?: keyof AuthStackParamList;
};

const Stack = createNativeStackNavigator<AuthStackParamList>();

export default function AuthNavigator({ initialRoute }: Props) {
  return (
    <Stack.Navigator
      initialRouteName={initialRoute ?? "SignInLanding"}
      screenOptions={{
        headerStyle: { backgroundColor: semantic.accentYellow },
        headerTintColor: semantic.textPrimary,
        headerTitleStyle: { fontFamily: fonts.display, fontWeight: "400", fontSize: 18 },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="SignInLanding" component={SignInLandingScreen} options={{ title: "Sign in" }} />
      <Stack.Screen name="EmailSignIn" component={EmailSignInScreen} options={{ title: "Sign in" }} />
      <Stack.Screen name="SignUpLanding" component={SignUpLandingScreen} options={{ title: "Create account" }} />
      <Stack.Screen name="EmailSignUp" component={EmailSignUpScreen} options={{ title: "Create account" }} />
      <Stack.Screen name="RequestPasswordReset" component={RequestPasswordResetScreen} options={{ title: "Reset password" }} />
      <Stack.Screen name="SetNewPassword" component={SetNewPasswordScreen} options={{ title: "New password" }} />
    </Stack.Navigator>
  );
}
