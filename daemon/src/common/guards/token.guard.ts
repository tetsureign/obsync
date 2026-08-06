import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { AppService } from '../../app.service';

@Injectable()
export class TokenGuard implements CanActivate {
  constructor(private appService: AppService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.headers['authorization'];

    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException();
    }

    const token = authHeader.slice(7);

    if (!this.appService.isValidToken(token)) {
      throw new UnauthorizedException();
    }

    return true;
  }
}
