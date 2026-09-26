/** 登录页预览专用：由 /auth/login 提交时调用，模拟请求延迟和账号校验，不创建真实会话。 */
export interface LoginCredentials {
  username: string;
  password: string;
}

export async function mockLogin(credentials: LoginCredentials): Promise<void> {
  // 保留短暂延迟，以便预览按钮加载状态；接入真实认证时整体替换此函数。
  await new Promise<void>((resolve) => setTimeout(resolve, 450));

  if (credentials.username !== 'admin' || credentials.password !== 'admin') {
    throw new Error('用户名或密码错误，请重新输入');
  }
}
