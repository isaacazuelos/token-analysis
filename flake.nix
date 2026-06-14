{
  description = "token-density: measure token density (tokens per byte) of popular npm JS/TS";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs = { self, nixpkgs }:
    let
      systems = [ "x86_64-linux" "aarch64-linux" "x86_64-darwin" "aarch64-darwin" ];
      forAllSystems = f:
        nixpkgs.lib.genAttrs systems (system: f {
          inherit system;
          pkgs = nixpkgs.legacyPackages.${system};
        });
    in
    {
      packages = forAllSystems ({ pkgs, ... }: rec {
        token-density = pkgs.buildNpmPackage {
          pname = "token-density";
          version = "0.1.0";
          src = ./.;

          # Hash of the fetched npm dependencies (just `typescript`). Regenerate
          # after changing package-lock.json with:
          #   nix run nixpkgs#prefetch-npm-deps -- package-lock.json
          npmDepsHash = "sha256-It/S5ySbl9EBErVjeZPrf+fGdslbbqIC9JAe5lwQm7s=";

          # Pure JS — no compile/bundle step, so skip the default `npm run build`.
          dontNpmBuild = true;

          meta = {
            description = "Measure token density of popular JavaScript/TypeScript npm code";
            mainProgram = "token-density";
            license = pkgs.lib.licenses.mit;
          };
        };
        default = token-density;
      });

      apps = forAllSystems ({ system, ... }: rec {
        token-density = {
          type = "app";
          program = "${self.packages.${system}.token-density}/bin/token-density";
        };
        default = token-density;
      });

      devShells = forAllSystems ({ pkgs, ... }: {
        default = pkgs.mkShell {
          packages = [ pkgs.nodejs ];
        };
      });
    };
}
