{ pkgs, ... }: {
  channel = "stable-24.05";

  packages = [
  ];

  env = { };

  idx = {
    extensions = [
      "google.gemini-cli-vscode-ide-companion"
    ];

    previews = {
      enable = true;
      previews = {
        web = {
          command = [ "bash" "-lc" "cd app && npm run dev -- --port $PORT --hostname 0.0.0.0" ];
          manager = "web";
        };
      };
    };
  };
}