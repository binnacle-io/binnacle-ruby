module Binnacle::Commands

  def self.help
    opts = Trollop::options do
      banner HELP_BANNER
    end

    Trollop::educate unless ENV["TEST_MODE"] == 'true'
  end
end

HELP_BANNER = <<-EOS
Usage:
   binnacle 'subcommand'

where [subcommands] are:
  tail: tails signals on a Binnacle Application or Channel
  help: shows this message

options for 'binnacle'
EOS
