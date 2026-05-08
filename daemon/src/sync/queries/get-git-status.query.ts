import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GitService } from '@/git/git.service';

export class GetGitStatusQuery {
  constructor(public readonly vaultId: string) {}
}

@QueryHandler(GetGitStatusQuery)
export class GetGitStatusHandler implements IQueryHandler<GetGitStatusQuery> {
  constructor(private readonly gitService: GitService) {}

  async execute(query: GetGitStatusQuery) {
    return await this.gitService.getStatus(query.vaultId);
  }
}
