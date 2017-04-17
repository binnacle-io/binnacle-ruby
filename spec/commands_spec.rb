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
    expect(`binnacle tail --help`.gsub("\n",'')).to eq(BINNACLE_TAIL_HELP.gsub("\n",''))
  end
end

describe BinnacleCommand do
  before { ENV["TEST_MODE"] = 'true' }

  it 'requires a known subcommand argument' do
    expect { BinnacleCommand.new.run(['foobar'])}.to output("I don't know the subcommand command 'foobar'\n").to_stdout
  end

  describe 'tail command' do
    it 'validates the passed params before executing' do
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

    it 'with -n flag returns recent events', :vcr do
      args = ["tail", "-n", "10", "-s", "60", "--host=localhost", "--channel=ylhcn28x7skv6av8q93m", "--api-key=jzr5d5kgj4j3l8fm90tr", "--api-secret=bz3e3w44o3323dypp8d7", "--no-encrypted"]

      expect { BinnacleCommand.new.run(args) }.to output(TAIL_DASH_L).to_stdout

      expect(a_request(:get, 'http://localhost:8080/api/endpoints'))
      expect(
        a_request(:get, "http://localhost:8080/api/events/ylhcn28x7skv6av8q93m/recents?limit=10&since=60")
      ).to(have_been_made.times(1))
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
  -l, --help                         Show this message
EOS

TAIL_DASH_L = <<-EOS
Retrieving last 10 lines since 60 minutes ago from Channel ylhcn28x7skv6av8q93m ...
INFO       [2015-10-22 13:37:28 -0700] TEST_EVT2  ::  client_id = io, session_id = SESS_01, ip = 0:0:0:0:0:0:0:1, tags = [["account", "upgrade"]]
INFO       [2015-10-22 13:37:32 -0700] TEST_EVT2  ::  client_id = io, session_id = SESS_01, ip = 0:0:0:0:0:0:0:1, tags = [["account", "upgrade"]]
INFO       [2015-10-22 13:37:32 -0700] TEST_EVT2  ::  client_id = io, session_id = SESS_01, ip = 0:0:0:0:0:0:0:1, tags = [["account", "upgrade"]]
INFO       [2015-10-22 13:37:33 -0700] TEST_EVT2  ::  client_id = io, session_id = SESS_01, ip = 0:0:0:0:0:0:0:1, tags = [["account", "upgrade"]]
INFO       [2015-10-22 13:37:36 -0700] TEST_EVT2  ::  client_id = io, session_id = SESS_01, ip = 0:0:0:0:0:0:0:1, tags = [["account", "upgrade"]]
EOS
