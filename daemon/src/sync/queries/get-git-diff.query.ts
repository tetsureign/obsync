import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GitService } from '@/git/git.service';

export class GetGitDiffQuery {
  constructor(
    public readonly vaultId: string,
    public readonly filePaths: string[],
  ) {}
}

@QueryHandler(GetGitDiffQuery)
export class GetGitDiffHandler implements IQueryHandler<GetGitDiffQuery> {
  constructor(private readonly gitService: GitService) {}

  async execute(query: GetGitDiffQuery) {
    return this.gitService.diff(query.vaultId, query.filePaths);
  }
}
