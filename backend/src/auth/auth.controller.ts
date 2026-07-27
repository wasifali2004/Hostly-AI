import { Body, Controller, Get, Post, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { AuthUser } from '../common/types/auth-user';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';

@Controller('auth')
export class AuthController {
  private readonly production: boolean;

  constructor(
    private readonly auth: AuthService,
    config: ConfigService,
  ) {
    this.production = config.get('NODE_ENV') === 'production';
  }

  @Public()
  @Post('signup')
  async signup(@Body() dto: SignupDto, @Res({ passthrough: true }) response: Response) {
    return this.respondWithSession(await this.auth.signup(dto), response);
  }

  @Public()
  @Post('login')
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) response: Response) {
    return this.respondWithSession(await this.auth.login(dto), response);
  }

  @Public()
  @Post('refresh')
  async refresh(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    return this.respondWithSession(
      await this.auth.refresh(request.cookies?.refresh_token),
      response,
    );
  }

  @Public()
  @Post('logout')
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    await this.auth.logout(request.cookies?.refresh_token);
    response.clearCookie('access_token', { path: '/' });
    response.clearCookie('refresh_token', { path: '/' });
    return { success: true };
  }

  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user.id);
  }

  private respondWithSession(
    session: {
      user: unknown;
      accessToken: string;
      refreshToken: string;
      accessTokenExpiresIn: number;
    },
    response: Response,
  ) {
    const common = {
      httpOnly: true,
      secure: this.production,
      sameSite: 'lax' as const,
      path: '/',
    };
    response.cookie('access_token', session.accessToken, {
      ...common,
      maxAge: 15 * 60 * 1000,
    });
    response.cookie('refresh_token', session.refreshToken, {
      ...common,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    return {
      user: session.user,
      accessTokenExpiresIn: session.accessTokenExpiresIn,
    };
  }
}
