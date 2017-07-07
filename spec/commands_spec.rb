require 'spec_helper'
require 'open3'

describe "binnacle command" do
  it 'requires a subcommand' do
    expect(`binnacle`).to eq(NO_SUBCOMMAND_GIVEN)
  end

  it 'returns an error message for unknown subcommands' do
    expect(`binnacle foo`).to eq("I don't know the subcommand command 'foo'\n")
  end

  it 'returns the help for the binnacle tail sub command' do
    expect(`binnacle tail --help`).to eq(BINNACLE_TAIL_HELP)
  end
end

describe BinnacleCommand do
  before do
    reset_env
    ENV["TEST_MODE"] = 'true' 
    Binnacle.configure do |config|
      config.encrypted = false
    end
  end

  it 'requires a known subcommand argument', :vcr do
    expect { BinnacleCommand.new.run(['foobar'])}.to output("I don't know the subcommand command 'foobar'\n").to_stdout
  end

  describe 'tail command' do
    it 'validates the passed params before executing', :vcr do
      expected_output = [
        %[The following errors prevented the tail command from executing:],
        %[  - No channel or app given],
        %[  - No authentication information given\n],
        %[SUBCOMMAND],
        %[      tail -- listen to a Binnacle channel or app\n\n]
      ].join("\n")
      expect {
        BinnacleCommand.new.run(["tail"])
      }.to output(expected_output).to_stdout
    end

    unless ENV["CI"] == "true"
      it 'with -n flag returns recent events', :vcr do
        args = ["tail", "-n", "10", "-s", "60", "--host=localhost", "--channel=icoc0tnol3obe8pas207", "--api-key=vceth4xcwqfoowpz2esi", "--api-secret=1grttyb8ozbe9axt88ji", "--environment=development", "--no-encrypted"]

        expect { BinnacleCommand.new.run(args) }.to output(TAIL_DASH_L).to_stdout

        expect(a_request(:get, 'http://localhost:8080/api/endpoints'))
        expect(
          a_request(:get, "http://localhost:8080/api/events/icoc0tnol3obe8pas207/production/recents?limit=10&since=60")
        ).to(have_been_made.times(1))
      end
    end
  end
end

NO_SUBCOMMAND_GIVEN = <<-EOS
Usage:
   binnacle 'subcommand'

where [subcommands] are:
  tail: tails signals on a Binnacle Application or Channel
  help: shows this message

options for 'binnacle'
  -h, --help    Show this message
EOS

BINNACLE_TAIL_HELP = <<-EOS
Usage:
   binnacle tail [options]

where [options] are:
  -h, --host=<s>                     Binnacle Host (default: localhost)
  -c, --channel=<s>                  Binnacle Channel
  -a, --app=<s>                      Binnacle App
  -u, --api-key=<s>                  Binnacle API Key
  -p, --api-secret=<s>               Binnacle API Secret
  -f, --follow                       Monitors a Binnacle Channel or App
  -n, --lines=<i>                    Get the last n events on the Channel
  -s, --since=<i>                    Number of minutes in the past to search
                                     for events
  -e, --encrypted, --no-encrypted    Use SSL/HTTPS (default: true)
  -v, --environment=<s>              The target environment (Rails.env)
                                     (default: production)
  -y, --payload                      Show JSON Payload
  -l, --help                         Show this message
EOS

TAIL_DASH_L = <<-EOS
Retrieving last 10 lines since 60 minutes ago from Channel icoc0tnol3obe8pas207 ...
production::INFO       [2017-07-06 14:59:36 -0400] log        :: ip = 0:0:0:0:0:0:0:1
production::DEBUG      [2017-07-06 14:59:37 -0400] log        :: ip = 0:0:0:0:0:0:0:1
production::INFO       [2017-07-06 15:21:31 -0400] failed_tra :: session_id = 8675309, ip = 0:0:0:0:0:0:0:1
production::INFO       [2017-07-06 15:22:45 -0400] failed_tra :: session_id = 8675309, ip = 0:0:0:0:0:0:0:1
production::DEBUG      [2017-07-06 15:23:03 -0400] log        :: ip = 0:0:0:0:0:0:0:1
production::INFO       [2017-07-06 15:23:21 -0400] log        :: ip = 0:0:0:0:0:0:0:1
EOS
