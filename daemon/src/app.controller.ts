import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';

@ApiBearerAuth()
@Controller('')
export class AppController {
  @Get('health')
  getHealth(): { status: string } {
    return { status: 'ok' };
  }
}
