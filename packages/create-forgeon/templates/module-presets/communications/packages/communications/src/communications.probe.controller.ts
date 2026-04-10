import { Body, Controller, Get, Post } from '@nestjs/common';
import { CommunicationsService } from './communications.service';
import { SendCommunicationsProbeDto } from './dto/send-communications-probe.dto';

@Controller('health')
export class CommunicationsProbeController {
  constructor(private readonly communicationsService: CommunicationsService) {}

  @Get('communications')
  getCommunicationsProbe() {
    return this.communicationsService.getProbeStatus();
  }

  @Post('communications')
  sendCommunicationsProbe(@Body() body: SendCommunicationsProbeDto) {
    return this.communicationsService.sendProbeEmail(body.email);
  }
}
