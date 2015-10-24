require 'trollop'
require_relative 'tail'

class BinnacleCommand
  def run(args)
    ARGV.push(*args) if ENV["TEST_MODE"] == 'true' # testing cheat

    subcommand = args[0].downcase.to_sym if args[0]
    begin
      if subcommand
        Binnacle::Commands.send(subcommand)
      else
        puts "The binnacle command requires a subcommand"
      end
    rescue NoMethodError => nme
      puts "I don't know the subcommand command '#{subcommand}'"
    end
  end
end
